import {
  ECSClient,
  DescribeServicesCommand,
  UpdateServiceCommand,
  ListContainerInstancesCommand,
} from '@aws-sdk/client-ecs';
import type { EcsStatus } from './types.js';

export class EcsControl {
  private client: ECSClient;

  constructor(region?: string) {
    this.client = new ECSClient({ region });
  }

  async describe(clusterArn: string, serviceName: string): Promise<EcsStatus> {
    const res = await this.client.send(
      new DescribeServicesCommand({
        cluster: clusterArn,
        services: [serviceName],
      }),
    );

    const svc = res.services?.[0];
    if (!svc) {
      throw new Error(`ECS service not found: ${serviceName} in ${clusterArn}`);
    }

    const ciRes = await this.client.send(
      new ListContainerInstancesCommand({ cluster: clusterArn }),
    );

    return {
      desiredCount: svc.desiredCount ?? 0,
      runningCount: svc.runningCount ?? 0,
      pendingCount: svc.pendingCount ?? 0,
      containerInstanceCount: ciRes.containerInstanceArns?.length ?? 0,
    };
  }

  async setDesiredCount(
    clusterArn: string,
    serviceName: string,
    desiredCount: number,
  ): Promise<void> {
    await this.client.send(
      new UpdateServiceCommand({
        cluster: clusterArn,
        service: serviceName,
        desiredCount,
      }),
    );
  }

  /** Running count matches desired count and desired > 0 */
  isRunning(status: EcsStatus): boolean {
    return (
      status.desiredCount > 0 && status.runningCount >= status.desiredCount
    );
  }

  /** All tasks stopped */
  isStopped(status: EcsStatus): boolean {
    return status.runningCount === 0 && status.pendingCount === 0;
  }
}
