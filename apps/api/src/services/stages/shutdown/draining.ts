import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'draining'> = {
  id: 'draining',
  label: 'Waiting for Auto Scaling Group drain',
  async check(ctx) {
    const asgStatus = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    return ctx.asg.isEmpty(asgStatus);
  },
  async action() {
    // Passive — AWS drains instances after ASG scales to zero.
  },
};

export default stage;
