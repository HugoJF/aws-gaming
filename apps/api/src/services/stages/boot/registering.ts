import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'registering'> = {
  id: 'registering',
  label: 'Registering EC2 instance with ECS cluster',
  async check(ctx) {
    const status = await ctx.ecs.describe(
      ctx.instance.ecsClusterArn,
      ctx.instance.ecsServiceName,
    );
    return status.containerInstanceCount > 0;
  },
  async action() {
    // Passive — instance registers itself with the ECS cluster.
  },
};

export default stage;
