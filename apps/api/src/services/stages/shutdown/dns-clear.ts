import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'dns_clear'> = {
  id: 'dns_clear',
  label: 'Removing Route53 DNS record',
  appliesTo: (i) => !!i.dnsName && !!i.route53ZoneId,
  async check(ctx) {
    return ctx.dns.verifyRecordDeleted(
      ctx.instance.route53ZoneId,
      ctx.instance.dnsName,
    );
  },
  async action(ctx) {
    await ctx.dns.deleteARecord(
      ctx.instance.route53ZoneId,
      ctx.instance.dnsName,
    );
  },
};

export default stage;
