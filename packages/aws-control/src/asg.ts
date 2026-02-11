import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  SetDesiredCapacityCommand,
  UpdateAutoScalingGroupCommand,
} from '@aws-sdk/client-auto-scaling';
import type { AsgStatus } from './types.js';

export class AsgControl {
  private client: AutoScalingClient;

  constructor(region?: string) {
    this.client = new AutoScalingClient({ region });
  }

  async describe(asgName: string): Promise<AsgStatus> {
    const res = await this.client.send(
      new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [asgName],
      }),
    );

    const asg = res.AutoScalingGroups?.[0];
    if (!asg) {
      throw new Error(`ASG not found: ${asgName}`);
    }

    return {
      desiredCapacity: asg.DesiredCapacity ?? 0,
      minSize: asg.MinSize ?? 0,
      maxSize: asg.MaxSize ?? 0,
      instances: (asg.Instances ?? []).map((i) => ({
        instanceId: i.InstanceId ?? '',
        lifecycleState: i.LifecycleState ?? '',
        healthStatus: i.HealthStatus ?? '',
      })),
    };
  }

  async scaleUp(asgName: string, desiredCapacity: number): Promise<void> {
    await this.client.send(
      new UpdateAutoScalingGroupCommand({
        AutoScalingGroupName: asgName,
        MinSize: desiredCapacity,
      }),
    );
    await this.client.send(
      new SetDesiredCapacityCommand({
        AutoScalingGroupName: asgName,
        DesiredCapacity: desiredCapacity,
      }),
    );
  }

  async scaleDown(asgName: string): Promise<void> {
    await this.client.send(
      new UpdateAutoScalingGroupCommand({
        AutoScalingGroupName: asgName,
        MinSize: 0,
      }),
    );
    await this.client.send(
      new SetDesiredCapacityCommand({
        AutoScalingGroupName: asgName,
        DesiredCapacity: 0,
      }),
    );
  }

  /** All instances are InService */
  allInService(status: AsgStatus): boolean {
    return (
      status.instances.length > 0 &&
      status.instances.length >= status.desiredCapacity &&
      status.instances.every((i) => i.lifecycleState === 'InService')
    );
  }

  /** No instances remain */
  isEmpty(status: AsgStatus): boolean {
    return status.instances.length === 0 && status.desiredCapacity === 0;
  }
}
