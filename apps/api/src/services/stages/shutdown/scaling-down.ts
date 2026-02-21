import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'scaling_down'> = {
  id: 'scaling_down',
  label: 'Scaling EC2 Auto Scaling Group to zero',
  async check(ctx) {
    const status = await ctx.asg.describe(ctx.instance.autoScalingGroupName);
    return status.desiredCapacity === 0 && status.minSize === 0;
  },
  async action(ctx) {
    await ctx.asg.scaleDown(ctx.instance.autoScalingGroupName);
  },
};

export default stage;
