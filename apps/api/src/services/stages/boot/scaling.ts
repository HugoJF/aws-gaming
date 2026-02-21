import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'scaling'> = {
  id: 'scaling',
  label: 'Scaling EC2 Auto Scaling Group up',
  async check(ctx) {
    const status = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    return ctx.asg.allInService(status);
  },
  async action(ctx) {
    await ctx.asg.scaleUp(
      ctx.instance.autoScalingGroupName,
      ctx.instance.instanceCount,
    );
  },
};

export default stage;
