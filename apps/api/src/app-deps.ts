import { AsgControl, EcsControl, Ec2Control, DnsControl } from '@aws-gaming/aws-control';
import { Repository } from './db/repository.js';
import { StatusService } from './services/status.js';
import { CostService } from './services/cost.js';
import { createAuthMiddleware, createAdminMiddleware } from './middleware/auth.js';

export interface AppDeps {
  repo: Repository;
  statusService: StatusService;
  costService: CostService;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  adminMiddleware: ReturnType<typeof createAdminMiddleware>;
}

function resolveTableName(env: NodeJS.ProcessEnv): string {
  return env.DYNAMODB_TABLE_NAME ?? env.DYNAMODB_TABLE ?? 'aws-gaming-dev';
}

function resolveRegion(env: NodeJS.ProcessEnv): string {
  return env.AWS_REGION ?? 'sa-east-1';
}

export function createAppDeps(env: NodeJS.ProcessEnv = process.env): AppDeps {
  const tableName = resolveTableName(env);
  const region = resolveRegion(env);

  const repo = new Repository(tableName, region);
  const statusService = new StatusService(
    repo,
    new AsgControl(region),
    new EcsControl(region),
    new Ec2Control(region),
    new DnsControl(region),
  );

  return {
    repo,
    statusService,
    costService: new CostService(region),
    authMiddleware: createAuthMiddleware(repo),
    adminMiddleware: createAdminMiddleware(),
  };
}
