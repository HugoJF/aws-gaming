import { Hono } from 'hono';
import type {
  BootstrapStatusResponse,
  BootstrapCreateAdminResponse,
} from '@aws-gaming/contracts';
import type { AppDeps } from '../app-deps.js';
import { BootstrapAlreadyCompletedError } from '../services/bootstrap.js';
import { bootstrapAdminBodySchema } from './bootstrap.schemas.js';

type BootstrapEnv = {
  Variables: {
    bootstrapService: AppDeps['bootstrapService'];
  };
};

export const bootstrapRoutes = new Hono<BootstrapEnv>();

bootstrapRoutes.get('/status', async (c) => {
  const bootstrapService = c.get('bootstrapService');
  return c.json({
    canBootstrap: await bootstrapService.canBootstrapAdmin(),
  } satisfies BootstrapStatusResponse);
});

bootstrapRoutes.post('/admin', async (c) => {
  const bootstrapService = c.get('bootstrapService');
  const rawBody = await c.req.json().catch(() => ({}));
  const parsedBody = bootstrapAdminBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return c.json({ error: 'JSON body must be an object' }, 400);
  }

  const label = parsedBody.data.label ?? 'Initial admin';

  try {
    const created = await bootstrapService.createInitialAdmin(label);
    return c.json(
      {
        token: created.token,
        rawToken: created.rawToken,
      } satisfies BootstrapCreateAdminResponse,
      201,
    );
  } catch (error) {
    if (error instanceof BootstrapAlreadyCompletedError) {
      return c.json({ error: 'Bootstrap already completed' }, 409);
    }
    throw error;
  }
});
