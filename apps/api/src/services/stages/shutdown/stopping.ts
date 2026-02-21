import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'stopping'> = {
  id: 'stopping',
  label: 'Stopping ECS service tasks',
  async check(ctx) {
    const status = await ctx.ecs.describe(
      ctx.instance.ecsClusterArn,
      ctx.instance.ecsServiceName,
    );
    return ctx.ecs.isStopped(status);
  },
  async action(ctx) {
    await ctx.ecs.setDesiredCount(
      ctx.instance.ecsClusterArn,
      ctx.instance.ecsServiceName,
      0,
    );
  },
};

export default stage;
