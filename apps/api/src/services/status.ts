import {
  AsgControl,
  EcsControl,
  Ec2Control,
  DnsControl,
} from '@aws-gaming/aws-control';
import { lookup } from 'node:dns/promises';
import type {
  GameInstance,
  ServerView,
  ServerStatus,
  HealthCheck,
  LiveData,
  PowerAction,
  PowerStage,
  BootStageId,
  ShutdownStageId,
  CachedServerStatus,
} from '@aws-gaming/contracts';
import { BOOT_STAGES, SHUTDOWN_STAGES } from '@aws-gaming/contracts';
import type { Repository } from '../db/repository.js';
import { queryGameServer } from './gamedig.js';

const BOOT_DEADLINE_MS = 10 * 60 * 1000; // 10 minutes
const STAGE_TIMEOUT_MS: Partial<Record<string, number>> = {
  scaling: 180_000,
  registering: 60_000,
  starting: 60_000,
  task_healthy: 120_000,
  dns_update: 30_000,
  dns_resolve: 30_000,
  game_ready: 120_000,
  stopping: 120_000,
  dns_clear: 30_000,
  scaling_down: 60_000,
  draining: 180_000,
};

export class StatusService {
  constructor(
    private repo: Repository,
    private asg: AsgControl,
    private ecs: EcsControl,
    private ec2: Ec2Control,
    private dns: DnsControl,
  ) {}

  /** Build full ServerView for a single instance, using cache when fresh */
  async buildServerView(instance: GameInstance): Promise<ServerView> {
    let powerAction = await this.repo.getPowerAction(instance.id);

    // Use cache when there is no active transition in progress.
    if (!this.isTransitionActive(powerAction)) {
      const cached = await this.repo.getCachedStatus(instance.id);
      if (cached) {
        return this.toServerView(instance, cached, powerAction);
      }
    }

    // If a transition is in progress, advance first so we don't perform
    // duplicate expensive probes (e.g. GameDig) in the same request.
    if (this.isTransitionActive(powerAction)) {
      await this.advancePowerAction(instance, powerAction);
      powerAction = await this.repo.getPowerAction(instance.id);
    }

    // Fetch fresh status once, based on the latest power action state.
    const freshStatus = await this.fetchFreshStatus(instance, powerAction);

    // Cache the result
    await this.repo.putCachedStatus(freshStatus);

    return this.toServerView(instance, freshStatus, powerAction);
  }

  /** Fetch live status from AWS APIs + GameDig */
  private async fetchFreshStatus(
    instance: GameInstance,
    powerAction: PowerAction | null = null,
  ): Promise<CachedServerStatus> {
    const [asgStatus, ecsStatus] = await Promise.all([
      this.asg.describe(instance.autoScalingGroupName).catch(() => null),
      this.ecs
        .describe(instance.ecsClusterArn, instance.ecsServiceName)
        .catch(() => null),
    ]);

    // Determine current status from AWS state
    let observedStatus: ServerStatus = instance.state ?? 'offline';
    if (asgStatus && ecsStatus) {
      if (ecsStatus.runningCount > 0) {
        observedStatus = 'online';
      } else if (asgStatus.desiredCapacity === 0) {
        observedStatus = 'offline';
      }
    }

    const publicIp = await this.resolvePublicIp(asgStatus);
    const queryHost = instance.dnsName ?? publicIp;
    // GameDig query (skip if ECS has no running tasks)
    let liveData: LiveData | null = null;
    if (
      observedStatus === 'online' &&
      instance.gameType !== 'generic' &&
      ecsStatus &&
      ecsStatus.runningCount > 0 &&
      queryHost
    ) {
      liveData = await queryGameServer({
        gameType: instance.gameType,
        host: queryHost,
        port: instance.queryPort ?? instance.hostPort,
      });
    }

    // Display status: power actions are UX hints and should not override
    // an actually-online server. Timeouts/errors are visual cues only.
    let status: ServerStatus = observedStatus;
    if (powerAction) {
      if (powerAction.action === 'on') {
        status = observedStatus === 'online' ? 'online' : 'booting';
      } else {
        status = observedStatus === 'offline' ? 'offline' : 'shutting-down';
      }
    }

    // Build health checks
    const healthChecks = this.buildHealthChecks(
      instance,
      asgStatus,
      ecsStatus,
      liveData,
      queryHost,
      status,
    );

    return {
      instanceId: instance.id,
      status,
      liveData,
      publicIp,
      healthChecks,
      fetchedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  private async resolvePublicIp(
    asgStatus: Awaited<ReturnType<AsgControl['describe']>> | null,
  ): Promise<string | null> {
    if (!asgStatus) return null;
    const instanceIds = asgStatus.instances.map((i) => i.instanceId);
    if (instanceIds.length === 0) return null;
    return this.ec2.getPublicIp(instanceIds).catch(() => null);
  }

  private buildHealthChecks(
    instance: GameInstance,
    asgStatus: Awaited<ReturnType<AsgControl['describe']>> | null,
    ecsStatus: Awaited<ReturnType<EcsControl['describe']>> | null,
    liveData: LiveData | null,
    queryHost: string | null,
    status: ServerStatus,
  ): HealthCheck[] {
    if (status === 'offline') {
      return [
        { name: 'EC2 Instance', status: 'unknown', detail: 'Server is off' },
        { name: 'ECS Task', status: 'unknown', detail: 'Server is off' },
        { name: 'Game Process', status: 'unknown', detail: 'Server is off' },
        { name: 'DNS', status: 'unknown', detail: 'Server is off' },
        { name: 'Network', status: 'unknown', detail: 'Server is off' },
      ];
    }

    const checks: HealthCheck[] = [];

    // EC2 Instance check
    if (asgStatus) {
      const inService = asgStatus.instances.filter(
        (i) => i.lifecycleState === 'InService',
      );
      if (inService.length === 0) {
        checks.push({
          name: 'EC2 Instance',
          status: 'unhealthy',
          detail: 'No instances InService',
        });
      } else if (inService.length < asgStatus.desiredCapacity) {
        checks.push({
          name: 'EC2 Instance',
          status: 'degraded',
          detail: `${inService.length}/${asgStatus.desiredCapacity} InService`,
        });
      } else {
        checks.push({
          name: 'EC2 Instance',
          status: 'healthy',
          detail: `${inService.length} InService`,
        });
      }
    } else {
      checks.push({
        name: 'EC2 Instance',
        status: 'unknown',
        detail: 'Unable to query ASG',
      });
    }

    // ECS Task check
    if (ecsStatus) {
      const healthSummary =
        ecsStatus.runningCount > 0
          ? `, task health healthy:${ecsStatus.healthyTaskCount} unhealthy:${ecsStatus.unhealthyTaskCount} unknown:${ecsStatus.unknownHealthTaskCount}`
          : '';

      if (ecsStatus.desiredCount === 0) {
        checks.push({
          name: 'ECS Task',
          status: 'unknown',
          detail: 'Service scaled to zero',
        });
      } else if (ecsStatus.runningCount === 0) {
        checks.push({
          name: 'ECS Task',
          status: 'unhealthy',
          detail: 'No tasks running',
        });
      } else if (ecsStatus.unhealthyTaskCount > 0) {
        checks.push({
          name: 'ECS Task',
          status: 'unhealthy',
          detail: `${ecsStatus.runningCount}/${ecsStatus.desiredCount} running${healthSummary}`,
        });
      } else if (
        ecsStatus.runningCount < ecsStatus.desiredCount ||
        ecsStatus.pendingCount > 0
      ) {
        checks.push({
          name: 'ECS Task',
          status: 'degraded',
          detail: `${ecsStatus.runningCount}/${ecsStatus.desiredCount} running${healthSummary}`,
        });
      } else if (ecsStatus.healthyTaskCount > 0) {
        checks.push({
          name: 'ECS Task',
          status: 'healthy',
          detail: `${ecsStatus.runningCount}/${ecsStatus.desiredCount} running${healthSummary}`,
        });
      } else if (ecsStatus.unknownHealthTaskCount > 0) {
        checks.push({
          name: 'ECS Task',
          status: 'unknown',
          detail: `${ecsStatus.runningCount}/${ecsStatus.desiredCount} running${healthSummary}`,
        });
      } else {
        checks.push({
          name: 'ECS Task',
          status: 'healthy',
          detail: `${ecsStatus.runningCount}/${ecsStatus.desiredCount} running`,
        });
      }
    } else {
      checks.push({
        name: 'ECS Task',
        status: 'unknown',
        detail: 'Unable to query ECS',
      });
    }

    // Game Process check (via GameDig)
    if (instance.gameType === 'generic') {
      checks.push({
        name: 'Game Process',
        status: ecsStatus && ecsStatus.runningCount > 0 ? 'healthy' : 'unknown',
        detail:
          ecsStatus && ecsStatus.runningCount > 0
            ? 'Generic mode (GameDig disabled)'
            : 'No running tasks',
      });
    } else if (liveData) {
      checks.push({
        name: 'Game Process',
        status: 'healthy',
        detail: `${liveData.players}/${liveData.maxPlayers} players`,
      });
    } else if (ecsStatus && ecsStatus.runningCount > 0 && queryHost) {
      checks.push({
        name: 'Game Process',
        status: 'unhealthy',
        detail: 'GameDig query failed',
      });
    } else if (ecsStatus && ecsStatus.runningCount > 0) {
      checks.push({
        name: 'Game Process',
        status: 'unknown',
        detail: 'No DNS or public IP available for GameDig',
      });
    } else {
      checks.push({
        name: 'Game Process',
        status: 'unknown',
        detail: 'No running tasks',
      });
    }

    // DNS check (placeholder — frontend augments with real ping)
    if (instance.dnsName && instance.route53ZoneId) {
      checks.push({
        name: 'DNS',
        status: status === 'online' ? 'healthy' : 'unknown',
        detail: instance.dnsName,
      });
    } else {
      checks.push({
        name: 'DNS',
        status: 'healthy',
        detail: 'DNS not configured (direct host/IP mode)',
      });
    }

    // Network check (reported by frontend, API provides last known)
    checks.push({
      name: 'Network',
      status: status === 'online' ? 'healthy' : 'unknown',
      detail: 'Reported by browser',
    });

    return checks;
  }

  private toServerView(
    instance: GameInstance,
    status: CachedServerStatus,
    powerAction?: PowerAction | null,
  ): ServerView {
    const host = instance.dnsName ?? status.publicIp ?? instance.id;
    const address = `${host}:${instance.hostPort}`;

    // Health sidecar is plain HTTP, and is meant for control-plane probes
    // (not a user-facing HTTPS endpoint).
    const healthHost = status.publicIp ?? instance.dnsName;
    const healthEndpoint =
      healthHost && status.status !== 'offline'
        ? `http://${healthHost}:${instance.healthPort}`
        : null;

    return {
      id: instance.id,
      displayName: instance.displayName,
      game: instance.gameType,
      gameLabel: instance.gameLabel,
      address,
      healthEndpoint,
      location: instance.location,
      maxPlayers: instance.maxPlayers,
      status: status.status,
      liveData: status.liveData,
      healthChecks: status.healthChecks,
      powerAction: powerAction ?? null,
      lastUpdatedAt: status.fetchedAt,
    };
  }

  /* ================================================================ */
  /*  Power State Machine                                              */
  /* ================================================================ */

  async startPowerAction(
    instance: GameInstance,
    action: 'on' | 'off',
  ): Promise<PowerAction> {
    const stageDefs = action === 'on' ? BOOT_STAGES : SHUTDOWN_STAGES;
    const now = new Date();

    const stages: PowerStage[] = stageDefs.map((def, i) => ({
      id: def.id,
      label: def.label,
      status: i === 0 ? 'in_progress' : 'pending',
      ...(i === 0 ? { startedAt: now.toISOString() } : {}),
    }));

    const powerAction: PowerAction = {
      action,
      stages,
      currentStageId: stages[0].id,
      startedAt: now.toISOString(),
      deadlineAt: new Date(now.getTime() + BOOT_DEADLINE_MS).toISOString(),
    };

    // Fire the first AWS action
    if (action === 'on') {
      await this.asg.scaleUp(
        instance.autoScalingGroupName,
        instance.instanceCount,
      );
    } else {
      await this.ecs.setDesiredCount(
        instance.ecsClusterArn,
        instance.ecsServiceName,
        0,
      );
    }

    // Persist
    await this.repo.putPowerAction(instance.id, powerAction);

    return powerAction;
  }

  /** Advance the state machine, called on each status poll */
  async advancePowerAction(
    instance: GameInstance,
    action: PowerAction,
  ): Promise<void> {
    const now = new Date();

    // Check overall deadline
    if (now.getTime() > new Date(action.deadlineAt).getTime()) {
      // Soft deadline: keep going, but mark for UI.
      if (!action.deadlineExceededAt) {
        action.deadlineExceededAt = now.toISOString();
        await this.repo.putPowerAction(instance.id, action);
      }
    }

    const currentStage = action.stages.find(
      (s) => s.id === action.currentStageId,
    );
    if (!currentStage) return;

    // Soft timeouts mean we should not permanently fail stages.
    // If a stage previously failed (legacy data), treat it as in-progress.
    if (currentStage.status === 'failed') {
      currentStage.status = 'in_progress';
      delete currentStage.completedAt;
      delete currentStage.error;
      await this.repo.putPowerAction(instance.id, action);
    }

    if (currentStage.status !== 'in_progress') return;

    // Check if current stage condition is met.
    // We do this before timeout checks to avoid false failures when polling is delayed.
    let conditionMet = false;
    try {
      conditionMet = await this.checkStageCondition(
        instance,
        action,
        currentStage.id,
      );
    } catch (error) {
      // Soft error: record it, but keep checking on subsequent polls.
      currentStage.error = `Stage check failed: ${this.toErrorMessage(error)}`;
      await this.repo.putPowerAction(instance.id, action);
    }

    if (conditionMet) {
      await this.completeStageAndAdvance(instance, action);
      return;
    }

    // Check individual stage timeout
    if (currentStage.startedAt) {
      const stageAge = now.getTime() - new Date(currentStage.startedAt).getTime();
      const maxAge = STAGE_TIMEOUT_MS[currentStage.id] ?? 120_000;
      if (stageAge > maxAge) {
        // Soft timeout: mark it once for UI, but keep checking for recovery.
        if (!currentStage.timedOutAt) {
          currentStage.timedOutAt = now.toISOString();
          currentStage.timedOutMessage = `Timed out after ${Math.round(stageAge / 1000)}s`;
          await this.repo.putPowerAction(instance.id, action);
        }
      }
    }

  }

  private async checkStageCondition(
    instance: GameInstance,
    action: PowerAction,
    stageId: string,
  ): Promise<boolean> {
    if (action.action === 'on') {
      return this.checkBootStageCondition(instance, stageId as BootStageId);
    }
    return this.checkShutdownStageCondition(instance, stageId as ShutdownStageId);
  }

  private async checkBootStageCondition(
    instance: GameInstance,
    stageId: BootStageId,
  ): Promise<boolean> {
    switch (stageId) {
      case 'scaling': {
        const asgStatus = await this.asg.describe(instance.autoScalingGroupName);
        return this.asg.allInService(asgStatus);
      }
      case 'registering': {
        const ecsStatus = await this.ecs.describe(
          instance.ecsClusterArn,
          instance.ecsServiceName,
        );
        return ecsStatus.containerInstanceCount > 0;
      }
      case 'starting': {
        // Fire the ECS update on first check
        await this.ecs.setDesiredCount(
          instance.ecsClusterArn,
          instance.ecsServiceName,
          instance.taskCount,
        );
        const ecsStatus = await this.ecs.describe(
          instance.ecsClusterArn,
          instance.ecsServiceName,
        );
        return this.ecs.isRunning(ecsStatus);
      }
      case 'task_healthy': {
        const ecsStatus = await this.ecs.describe(
          instance.ecsClusterArn,
          instance.ecsServiceName,
        );
        return (
          ecsStatus.desiredCount > 0 &&
          ecsStatus.healthyTaskCount >= ecsStatus.desiredCount
        );
      }
      case 'dns_update': {
        if (!instance.dnsName || !instance.route53ZoneId) return true;
        const asgStatus = await this.asg.describe(instance.autoScalingGroupName);
        const instanceIds = asgStatus.instances.map((i) => i.instanceId);
        const publicIp = await this.ec2.getPublicIp(instanceIds);
        if (!publicIp) return false;
        await this.dns.upsertARecord(
          instance.route53ZoneId,
          instance.dnsName,
          publicIp,
        );
        return this.dns.verifyRecord(
          instance.route53ZoneId,
          instance.dnsName,
          publicIp,
        );
      }
      case 'dns_resolve': {
        if (!instance.dnsName) return true;

        // If we can determine the expected public IP, wait until DNS resolves to it.
        // This keeps "DNS ready" separate from the game query probe.
        const expectedIp =
          (await this.resolvePublicIp(
            await this.asg.describe(instance.autoScalingGroupName),
          )) ?? null;

        try {
          const resolved = await lookup(instance.dnsName, { family: 4 });
          if (!resolved.address) return false;
          return expectedIp ? resolved.address === expectedIp : true;
        } catch {
          return false;
        }
      }
      case 'game_ready': {
        if (instance.gameType === 'generic') return true;

        // Query readiness should reflect what players will use. If DNS is configured,
        // we query via the DNS name (dns_resolve stage should ensure it propagates).
        const host =
          instance.dnsName ??
          (await this.resolvePublicIp(
            await this.asg.describe(instance.autoScalingGroupName),
          ));
        if (!host) return true;

        const liveData = await queryGameServer({
          gameType: instance.gameType,
          host,
          port: instance.queryPort ?? instance.hostPort,
        });
        return liveData !== null;
      }
      case 'ready':
        return true;
    }
  }

  private async checkShutdownStageCondition(
    instance: GameInstance,
    stageId: ShutdownStageId,
  ): Promise<boolean> {
    switch (stageId) {
      case 'stopping': {
        const ecsStatus = await this.ecs.describe(
          instance.ecsClusterArn,
          instance.ecsServiceName,
        );
        return this.ecs.isStopped(ecsStatus);
      }
      case 'dns_clear': {
        if (!instance.dnsName || !instance.route53ZoneId) return true;
        await this.dns.deleteARecord(instance.route53ZoneId, instance.dnsName);
        return this.dns.verifyRecordDeleted(
          instance.route53ZoneId,
          instance.dnsName,
        );
      }
      case 'scaling_down': {
        await this.asg.scaleDown(instance.autoScalingGroupName);
        const asgStatus = await this.asg.describe(instance.autoScalingGroupName);
        return asgStatus.desiredCapacity === 0 && asgStatus.minSize === 0;
      }
      case 'draining': {
        const [ecsStatus, asgStatus] = await Promise.all([
          this.ecs.describe(
            instance.ecsClusterArn,
            instance.ecsServiceName,
          ),
          this.asg.describe(instance.autoScalingGroupName),
        ]);
        return ecsStatus.containerInstanceCount === 0 && this.asg.isEmpty(asgStatus);
      }
      case 'stopped':
        return true;
    }
  }

  private hasFailedStage(action: PowerAction): boolean {
    return action.stages.some((stage) => stage.status === 'failed');
  }

  private isTransitionActive(action: PowerAction | null): action is PowerAction {
    if (!action) return false;
    const current = action.stages.find((stage) => stage.id === action.currentStageId);
    return current?.status === 'in_progress';
  }

  private async completeStageAndAdvance(
    instance: GameInstance,
    action: PowerAction,
  ): Promise<void> {
    const now = new Date().toISOString();
    const currentIndex = action.stages.findIndex(
      (s) => s.id === action.currentStageId,
    );

    // Mark current stage completed
    action.stages[currentIndex] = {
      ...action.stages[currentIndex],
      status: 'completed',
      completedAt: now,
      // Clear transient UI markers.
      error: undefined,
      timedOutAt: undefined,
      timedOutMessage: undefined,
    };

    const nextIndex = currentIndex + 1;

    if (nextIndex >= action.stages.length) {
      // All stages done — finalize
      await this.repo.deletePowerAction(instance.id);
      return;
    }

    // Start next stage
    action.stages[nextIndex] = {
      ...action.stages[nextIndex],
      status: 'in_progress',
      startedAt: now,
    };
    action.currentStageId = action.stages[nextIndex].id;

    await this.repo.putPowerAction(instance.id, action);
  }

  private async failCurrentStage(
    instance: GameInstance,
    action: PowerAction,
    error: string,
  ): Promise<void> {
    const currentIndex = action.stages.findIndex(
      (s) => s.id === action.currentStageId,
    );

    action.stages[currentIndex] = {
      ...action.stages[currentIndex],
      status: 'failed',
      completedAt: new Date().toISOString(),
      error,
    };

    await this.repo.putPowerAction(instance.id, action);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return 'unknown error';
    }
  }

}
