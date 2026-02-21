import type { StageDefinition } from '../types.js';
import { queryGameServer } from '../../gamedig.js';

const stage: StageDefinition<'game_ready'> = {
  id: 'game_ready',
  label: 'Waiting for game query response',
  appliesTo: (i) => i.gameType !== 'generic',
  async check(ctx) {
    const asgStatus = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    const instanceIds = asgStatus.instances.map((i) => i.instanceId);
    const host =
      ctx.instance.dnsName ?? (await ctx.ec2.getPublicIp(instanceIds));
    if (!host) return true;
    const liveData = await queryGameServer({
      gameType: ctx.instance.gameType,
      host,
      port: ctx.instance.queryPort ?? ctx.instance.hostPort,
    });
    return liveData !== null;
  },
  async action() {
    // Passive — game server starts accepting queries on its own.
  },
};

export default stage;
