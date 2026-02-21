import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'task_healthy'> = {
  id: 'task_healthy',
  label: 'Waiting for container health check',
  async check(ctx) {
    const status = await ctx.ecs.describe(
      ctx.instance.ecsClusterArn,
      ctx.instance.ecsServiceName,
    );
    return (
      status.desiredCount > 0 &&
      status.healthyTaskCount >= status.desiredCount
    );
  },
  async action() {
    // Passive — ECS runs the container health check.
  },
};

export default stage;
