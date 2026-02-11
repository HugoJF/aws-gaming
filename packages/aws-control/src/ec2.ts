import {
  EC2Client,
  DescribeInstancesCommand,
} from '@aws-sdk/client-ec2';
import type { Ec2InstanceInfo } from './types.js';

export class Ec2Control {
  private client: EC2Client;

  constructor(region?: string) {
    this.client = new EC2Client({ region });
  }

  async describeInstances(instanceIds: string[]): Promise<Ec2InstanceInfo[]> {
    if (instanceIds.length === 0) return [];

    const res = await this.client.send(
      new DescribeInstancesCommand({ InstanceIds: instanceIds }),
    );

    const instances: Ec2InstanceInfo[] = [];
    for (const reservation of res.Reservations ?? []) {
      for (const inst of reservation.Instances ?? []) {
        instances.push({
          instanceId: inst.InstanceId ?? '',
          publicIp: inst.PublicIpAddress ?? null,
          privateIp: inst.PrivateIpAddress ?? null,
          state: inst.State?.Name ?? 'unknown',
        });
      }
    }
    return instances;
  }

  /** Get the public IP of the first running instance */
  async getPublicIp(instanceIds: string[]): Promise<string | null> {
    const instances = await this.describeInstances(instanceIds);
    const running = instances.find(
      (i) => i.state === 'running' && i.publicIp,
    );
    return running?.publicIp ?? null;
  }
}
