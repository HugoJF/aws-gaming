import { Hono } from 'hono';
import { createOpaqueToken, hashOpaqueToken } from '@aws-gaming/auth-links';
import type {
  SecretAccessToken,
  BootstrapStatusResponse,
  BootstrapCreateAdminResponse,
} from '@aws-gaming/contracts';
import type { AppDeps } from '../app-deps.js';
import { bootstrapAdminBodySchema } from './bootstrap.schemas.js';
import { toAdminTokenView } from './token-utils.js';

type BootstrapEnv = {
  Variables: {
    repo: AppDeps['repo'];
  };
};

async function canBootstrapAdmin(repo: AppDeps['repo']): Promise<boolean> {
  const tokens = await repo.listTokens();
  return tokens.length === 0;
}

export const bootstrapRoutes = new Hono<BootstrapEnv>();

bootstrapRoutes.get('/status', async (c) => {
  const repo = c.get('repo');
  return c.json({
    canBootstrap: await canBootstrapAdmin(repo),
  } satisfies BootstrapStatusResponse);
});

bootstrapRoutes.post('/admin', async (c) => {
  const repo = c.get('repo');
  if (!(await canBootstrapAdmin(repo))) {
    return c.json({ error: 'Bootstrap already completed' }, 409);
  }

  const rawBody = await c.req.json().catch(() => ({}));
  const parsedBody = bootstrapAdminBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return c.json({ error: 'JSON body must be an object' }, 400);
  }

  const label = parsedBody.data.label ?? 'Initial admin';
  const instanceIds = (await repo.listInstances()).map((instance) => instance.id);
  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const token: SecretAccessToken = {
    id: `tok_${crypto.randomUUID().slice(0, 8)}`,
    tokenHash,
    label,
    gameInstanceIds: instanceIds,
    expiresAt: null,
    isAdmin: true,
    createdAt: new Date().toISOString(),
  };

  await repo.putToken(token);

  return c.json(
    {
      token: toAdminTokenView(token),
      rawToken,
    } satisfies BootstrapCreateAdminResponse,
    201,
  );
});
