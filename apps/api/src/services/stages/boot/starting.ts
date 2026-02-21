import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'starting'> = {
  id: 'starting',
  label: 'Starting ECS service tasks',
  async check(ctx) {
    const status = await ctx.ecs.describe(
      ctx.instance.ecsClusterArn,
      ctx.instance.ecsServiceName,
    );
    return ctx.ecs.isRunning(status);
  },
  async action(ctx) {
    await ctx.ecs.setDesiredCount(
      ctx.instance.ecsClusterArn,
      ctx.instance.ecsServiceName,
      ctx.instance.taskCount,
    );
  },
};

export default stage;
