import { lookup } from 'node:dns/promises';
import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'dns_resolve'> = {
  id: 'dns_resolve',
  label: 'Waiting for DNS to resolve',
  appliesTo: (i) => !!i.dnsName,
  async check(ctx) {
    const asgStatus = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    const instanceIds = asgStatus.instances.map((i) => i.instanceId);
    const expectedIp = await ctx.ec2.getPublicIp(instanceIds);
    try {
      const resolved = await lookup(ctx.instance.dnsName, { family: 4 });
      if (!resolved.address) return false;
      return expectedIp ? resolved.address === expectedIp : true;
    } catch {
      return false;
    }
  },
  async action() {
    // Passive — DNS propagation is handled by Route53.
  },
};

export default stage;
