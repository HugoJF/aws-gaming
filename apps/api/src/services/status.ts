import {
  AsgControl,
  EcsControl,
  Ec2Control,
  DnsControl,
} from '@aws-gaming/aws-control';
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
  dns_update: 30_000,
  game_ready: 120_000,
  ready: 5_000,
  stopping: 60_000,
  dns_clear: 10_000,
  draining: 30_000,
  scaling_down: 120_000,
  stopped: 5_000,
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
    // Check cache first
    const cached = await this.repo.getCachedStatus(instance.id);
    if (cached) {
      return this.toServerView(instance, cached);
    }

    // Fetch fresh status
    const freshStatus = await this.fetchFreshStatus(instance);

    // Advance power action if one is in progress
    const powerAction = await this.repo.getPowerAction(instance.id);
    if (powerAction) {
      await this.advancePowerAction(instance, powerAction, freshStatus);
    }

    // Cache the result
    await this.repo.putCachedStatus(freshStatus);

    return this.toServerView(instance, freshStatus, powerAction);
  }

  /** Fetch live status from AWS APIs + GameDig */
  private async fetchFreshStatus(
    instance: GameInstance,
  ): Promise<CachedServerStatus> {
    const [asgStatus, ecsStatus] = await Promise.all([
      this.asg.describe(instance.autoScalingGroupName).catch(() => null),
      this.ecs
        .describe(instance.ecsClusterArn, instance.ecsServiceName)
        .catch(() => null),
    ]);

    // Determine current status from AWS state
    let status: ServerStatus = instance.state;
    if (asgStatus && ecsStatus) {
      if (ecsStatus.runningCount > 0) {
        status = 'online';
      } else if (asgStatus.desiredCapacity === 0) {
        status = 'offline';
      }
    }

    // Preserve booting/shutting-down if a power action is in progress
    const powerAction = await this.repo.getPowerAction(instance.id);
    if (powerAction) {
      status = powerAction.action === 'on' ? 'booting' : 'shutting-down';
    }

    // GameDig query (skip if ECS has no running tasks)
    let liveData: LiveData | null = null;
    if (ecsStatus && ecsStatus.runningCount > 0 && instance.dnsName) {
      liveData = await queryGameServer({
        gameType: instance.gameType,
        host: instance.dnsName,
        port: instance.queryPort ?? instance.hostPort,
      });
    }

    // Build health checks
    const healthChecks = this.buildHealthChecks(
      instance,
      asgStatus,
      ecsStatus,
      liveData,
      status,
    );

    // Update instance state in DB if it changed
    if (status !== instance.state && !powerAction) {
      await this.repo.updateInstanceState(instance.id, status);
    }

    return {
      instanceId: instance.id,
      status,
      liveData,
      healthChecks,
      fetchedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  private buildHealthChecks(
    instance: GameInstance,
    asgStatus: Awaited<ReturnType<AsgControl['describe']>> | null,
    ecsStatus: Awaited<ReturnType<EcsControl['describe']>> | null,
    liveData: LiveData | null,
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
      if (ecsStatus.runningCount >= ecsStatus.desiredCount && ecsStatus.desiredCount > 0) {
        checks.push({
          name: 'ECS Task',
          status: 'healthy',
          detail: `${ecsStatus.runningCount} running`,
        });
      } else if (ecsStatus.runningCount > 0) {
        checks.push({
          name: 'ECS Task',
          status: 'degraded',
          detail: `${ecsStatus.runningCount}/${ecsStatus.desiredCount} running`,
        });
      } else {
        checks.push({
          name: 'ECS Task',
          status: 'unhealthy',
          detail: 'No tasks running',
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
    if (liveData) {
      checks.push({
        name: 'Game Process',
        status: 'healthy',
        detail: `${liveData.players}/${liveData.maxPlayers} players`,
      });
    } else if (ecsStatus && ecsStatus.runningCount > 0) {
      checks.push({
        name: 'Game Process',
        status: 'unhealthy',
        detail: 'GameDig query failed',
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
        status: 'unknown',
        detail: 'No DNS configured',
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
    const address = instance.dnsName
      ? `${instance.dnsName}:${instance.hostPort}`
      : `${instance.id}:${instance.hostPort}`;

    const healthEndpoint =
      instance.dnsName && status.status !== 'offline'
        ? `${instance.dnsName}:${instance.healthPort}`
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
    await this.repo.updateInstanceState(
      instance.id,
      action === 'on' ? 'booting' : 'shutting-down',
    );

    return powerAction;
  }

  /** Advance the state machine, called on each status poll */
  async advancePowerAction(
    instance: GameInstance,
    action: PowerAction,
    freshStatus: CachedServerStatus,
  ): Promise<void> {
    const now = new Date();

    // Check overall deadline
    if (now.getTime() > new Date(action.deadlineAt).getTime()) {
      await this.failCurrentStage(instance, action, 'Overall deadline exceeded');
      return;
    }

    const currentStage = action.stages.find(
      (s) => s.id === action.currentStageId,
    );
    if (!currentStage || currentStage.status !== 'in_progress') return;

    // Check individual stage timeout
    if (currentStage.startedAt) {
      const stageAge = now.getTime() - new Date(currentStage.startedAt).getTime();
      const maxAge = STAGE_TIMEOUT_MS[currentStage.id] ?? 120_000;
      if (stageAge > maxAge) {
        await this.failCurrentStage(
          instance,
          action,
          `Stage timed out after ${Math.round(stageAge / 1000)}s`,
        );
        return;
      }
    }

    // Check if current stage condition is met
    const conditionMet = await this.checkStageCondition(
      instance,
      action,
      currentStage.id,
    );

    if (conditionMet) {
      await this.completeStageAndAdvance(instance, action);
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
      case 'game_ready': {
        if (!instance.dnsName) return true;
        const liveData = await queryGameServer({
          gameType: instance.gameType,
          host: instance.dnsName,
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
        return true;
      }
      case 'draining': {
        const ecsStatus = await this.ecs.describe(
          instance.ecsClusterArn,
          instance.ecsServiceName,
        );
        return ecsStatus.containerInstanceCount === 0 || ecsStatus.runningCount === 0;
      }
      case 'scaling_down': {
        await this.asg.scaleDown(instance.autoScalingGroupName);
        const asgStatus = await this.asg.describe(instance.autoScalingGroupName);
        return this.asg.isEmpty(asgStatus);
      }
      case 'stopped':
        return true;
    }
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
    };

    const nextIndex = currentIndex + 1;

    if (nextIndex >= action.stages.length) {
      // All stages done — finalize
      const finalState = action.action === 'on' ? 'online' : 'offline';
      await this.repo.updateInstanceState(instance.id, finalState);
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
    await this.repo.updateInstanceState(instance.id, 'error');
  }
}
