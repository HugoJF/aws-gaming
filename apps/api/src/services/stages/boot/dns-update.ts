import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'dns_update'> = {
  id: 'dns_update',
  label: 'Updating Route53 DNS record',
  appliesTo: (i) => !!i.dnsName && !!i.route53ZoneId,
  async check(ctx) {
    const asgStatus = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    const instanceIds = asgStatus.instances.map((i) => i.instanceId);
    const publicIp = await ctx.ec2.getPublicIp(instanceIds);
    if (!publicIp) return false;
    return ctx.dns.verifyRecord(
      ctx.instance.route53ZoneId,
      ctx.instance.dnsName,
      publicIp,
    );
  },
  async action(ctx) {
    const asgStatus = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    const instanceIds = asgStatus.instances.map((i) => i.instanceId);
    const publicIp = await ctx.ec2.getPublicIp(instanceIds);
    if (!publicIp) return;
    await ctx.dns.upsertARecord(
      ctx.instance.route53ZoneId,
      ctx.instance.dnsName,
      publicIp,
    );
  },
};

export default stage;
