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
  TransitionIntent,
  PowerStage,
  PowerStageId,
  CachedServerStatus,
} from '@aws-gaming/contracts';
import type { Repository } from '../db/repository.js';
import { queryGameServer } from './gamedig.js';
import {
  BOOT_STAGES,
  SHUTDOWN_STAGES,
  type StageContext,
} from './stages/index.js';

const TRANSITION_DEADLINE_MS = 10 * 60 * 1000;
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;

export class StatusService {
  constructor(
    private repo: Repository,
    private asg: AsgControl,
    private ecs: EcsControl,
    private ec2: Ec2Control,
    private dns: DnsControl,
  ) {}

  private applicableStages(instance: GameInstance, action: 'on' | 'off') {
    const all = action === 'on' ? BOOT_STAGES : SHUTDOWN_STAGES;
    return all.filter((s) => !s.appliesTo || s.appliesTo(instance));
  }

  private stageContext(instance: GameInstance): StageContext {
    return {
      instance,
      asg: this.asg,
      ecs: this.ecs,
      ec2: this.ec2,
      dns: this.dns,
    };
  }

  /** Build full ServerView for a single instance, using cache when fresh */
  async buildServerView(instance: GameInstance): Promise<ServerView> {
    let transition = await this.repo.getTransition(instance.id);

    // Use cache when there is no active transition and cache is fresh (5 min).
    if (!transition) {
      const cached = await this.repo.getCachedStatus(instance.id);
      if (cached) {
        const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
        if (ageMs < STATUS_CACHE_TTL_MS) {
          const stages = await this.computeStages(instance, cached.status);
          return this.toServerView(instance, cached, transition, stages);
        }
      }
    }

    // If a transition is active, advance it (fire unfired actions).
    if (transition) {
      transition = await this.advanceTransition(instance, transition);
    }

    // Fetch fresh status
    const freshStatus = await this.fetchFreshStatus(instance);

    // Cache the result
    await this.repo.putCachedStatus(freshStatus);

    // If all stages are done and transition is active, clean it up
    if (transition && freshStatus.status !== 'booting' && freshStatus.status !== 'shutting-down') {
      await this.repo.deleteTransition(instance.id);
      transition = null;
    }

    // Compute stages from live checks
    const stages = await this.computeStages(instance, freshStatus.status);

    return this.toServerView(instance, freshStatus, transition, stages);
  }

  /* ================================================================ */
  /*  Stage Computation (always from live AWS state)                    */
  /* ================================================================ */

  private async computeStages(
    instance: GameInstance,
    status: ServerStatus,
  ): Promise<PowerStage[]> {
    if (status === 'offline' || status === 'online' || status === 'error') return [];

    const action: 'on' | 'off' = status === 'booting' ? 'on' : 'off';
    const stageDefs = this.applicableStages(instance, action);
    const ctx = this.stageContext(instance);

    // Evaluate stages sequentially: once a stage fails, the rest are pending.
    const stages: PowerStage[] = [];
    let reachedIncomplete = false;

    for (const def of stageDefs) {
      if (reachedIncomplete) {
        stages.push({ id: def.id, label: def.label, status: 'pending' });
        continue;
      }

      let met = false;
      let error: string | undefined;
      try {
        met = await def.check(ctx);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      if (met) {
        stages.push({ id: def.id, label: def.label, status: 'completed' });
      } else {
        reachedIncomplete = true;
        stages.push({
          id: def.id,
          label: def.label,
          status: 'in_progress',
          ...(error ? { error } : {}),
        });
      }
    }

    return stages;
  }

  /* ================================================================ */
  /*  Status Computation                                               */
  /* ================================================================ */

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

    const desiredState = instance.desiredState;

    // If desiredState was never set, we can't determine intent — show error.
    // The user can fix this by toggling power (which sets desiredState).
    let status: ServerStatus;
    if (!desiredState) {
      status = 'error';
    } else if (desiredState === 'on') {
      const allBootDone = await this.allStagesMet(instance, 'on');
      status = allBootDone ? 'online' : 'booting';
    } else {
      const allShutdownDone = await this.allStagesMet(instance, 'off');
      status = allShutdownDone ? 'offline' : 'shutting-down';
    }

    const publicIp = await this.resolvePublicIp(asgStatus);
    const queryHost = instance.dnsName ?? publicIp;
    let liveData: LiveData | null = null;
    if (
      status === 'online' &&
      instance.gameType !== 'generic' &&
      queryHost
    ) {
      liveData = await queryGameServer({
        gameType: instance.gameType,
        host: queryHost,
        port: instance.queryPort ?? instance.hostPort,
      });
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

  private async allStagesMet(
    instance: GameInstance,
    action: 'on' | 'off',
  ): Promise<boolean> {
    const ctx = this.stageContext(instance);
    const stageDefs = this.applicableStages(instance, action);
    const results = await Promise.all(
      stageDefs.map((s) => s.check(ctx).catch(() => false)),
    );
    return results.every(Boolean);
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
        { name: 'EC2 Instance', status: 'unhealthy', detail: 'Server is off' },
        { name: 'ECS Task', status: 'unhealthy', detail: 'Server is off' },
        { name: 'Game Process', status: 'unhealthy', detail: 'Server is off' },
        { name: 'DNS', status: 'unhealthy', detail: 'Server is off' },
        { name: 'Network', status: 'unhealthy', detail: 'Server is off' },
      ];
    }

    const checks: HealthCheck[] = [];

    // EC2 Instance check
    if (asgStatus) {
      const inService = asgStatus.instances.filter(
        (i) => i.lifecycleState === 'InService',
      );
      if (inService.length < asgStatus.desiredCapacity) {
        checks.push({
          name: 'EC2 Instance',
          status: 'unhealthy',
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
        status: 'unhealthy',
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
          status: 'unhealthy',
          detail: 'Service scaled to zero',
        });
      } else if (
        ecsStatus.runningCount < ecsStatus.desiredCount ||
        ecsStatus.pendingCount > 0 ||
        ecsStatus.unhealthyTaskCount > 0 ||
        ecsStatus.unknownHealthTaskCount > 0
      ) {
        checks.push({
          name: 'ECS Task',
          status: 'unhealthy',
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
        status: 'unhealthy',
        detail: 'Unable to query ECS',
      });
    }

    // Game Process check (via GameDig)
    if (instance.gameType === 'generic') {
      checks.push({
        name: 'Game Process',
        status: ecsStatus && ecsStatus.runningCount > 0 ? 'healthy' : 'unhealthy',
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
        status: 'unhealthy',
        detail: 'No DNS or public IP available for GameDig',
      });
    } else {
      checks.push({
        name: 'Game Process',
        status: 'unhealthy',
        detail: 'No running tasks',
      });
    }

    // DNS check (placeholder — frontend augments with real ping)
    if (instance.dnsName && instance.route53ZoneId) {
      checks.push({
        name: 'DNS',
        status: status === 'online' ? 'healthy' : 'unhealthy',
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
      status: status === 'online' ? 'healthy' : 'unhealthy',
      detail: 'Reported by browser',
    });

    return checks;
  }

  private toServerView(
    instance: GameInstance,
    status: CachedServerStatus,
    transition: TransitionIntent | null,
    stages: PowerStage[],
  ): ServerView {
    const host = instance.dnsName ?? status.publicIp ?? instance.id;
    const address = `${host}:${instance.hostPort}`;

    const healthHost = status.publicIp ?? instance.dnsName;
    const healthEndpoint =
      healthHost && status.status !== 'offline'
        ? `${healthHost}:${instance.healthPort}`
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
      transition,
      stages,
      lastUpdatedAt: status.fetchedAt,
    };
  }

  /* ================================================================ */
  /*  Transition                                                       */
  /* ================================================================ */

  async startTransition(
    instance: GameInstance,
    action: 'on' | 'off',
  ): Promise<TransitionIntent> {
    const now = new Date();
    const ctx = this.stageContext(instance);
    const stageDefs = this.applicableStages(instance, action);

    const transition: TransitionIntent = {
      action,
      firedActions: [],
      startedAt: now.toISOString(),
      deadlineAt: new Date(now.getTime() + TRANSITION_DEADLINE_MS).toISOString(),
    };

    // Fire the first stage's action
    const firstStage = stageDefs[0];
    await firstStage.action(ctx);
    transition.firedActions.push(firstStage.id);

    // Persist desired state and transition
    instance.desiredState = action === 'on' ? 'on' : 'off';
    await Promise.all([
      this.repo.putInstance(instance),
      this.repo.putTransition(instance.id, transition),
    ]);

    return transition;
  }

  /** Advance the transition by firing unfired stage actions when
   *  their preceding stage's check passes. */
  private async advanceTransition(
    instance: GameInstance,
    transition: TransitionIntent,
  ): Promise<TransitionIntent> {
    const now = new Date();
    const ctx = this.stageContext(instance);
    const stageDefs = this.applicableStages(instance, transition.action);

    // Check overall deadline (soft — just mark it)
    if (
      now.getTime() > new Date(transition.deadlineAt).getTime() &&
      !transition.deadlineExceededAt
    ) {
      transition.deadlineExceededAt = now.toISOString();
      await this.repo.putTransition(instance.id, transition);
    }

    // Walk through stages: for each stage whose action hasn't been fired,
    // check if the previous stage's condition is met. If so, fire the action.
    let updated = false;
    for (let i = 0; i < stageDefs.length; i++) {
      const stage = stageDefs[i];
      if (transition.firedActions.includes(stage.id)) continue;

      // Check if the previous stage's condition is met
      if (i > 0) {
        const prevStage = stageDefs[i - 1];
        let prevMet = false;
        try {
          prevMet = await prevStage.check(ctx);
        } catch {
          // Previous stage check failed — don't advance yet
          break;
        }
        if (!prevMet) break;
      }

      // Fire this stage's action
      try {
        await stage.action(ctx);
        transition.firedActions.push(stage.id);
        updated = true;
      } catch {
        // Action failed — stop advancing, will retry next poll
        break;
      }
    }

    // Check if all stages are complete
    let allComplete = true;
    for (const stage of stageDefs) {
      try {
        if (!(await stage.check(ctx))) {
          allComplete = false;
          break;
        }
      } catch {
        allComplete = false;
        break;
      }
    }

    if (allComplete) {
      await this.repo.deleteTransition(instance.id);
      return transition;
    }

    if (updated) {
      await this.repo.putTransition(instance.id, transition);
    }

    return transition;
  }
}
