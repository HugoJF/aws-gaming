import { Hono } from 'hono';
import type {
  ListServersResponse,
  ServerStatusResponse,
  ServerCostResponse,
  ServerPingResponse,
  TransitionRequest,
  TransitionResponse,
  MeResponse,
  ServerView,
} from '@aws-gaming/contracts';
import { getAuthContext } from '../middleware/auth.js';
import type { AppDeps } from '../app-deps.js';

type AuthenticatedApiEnv = {
  Variables: {
    repo: AppDeps['repo'];
    statusService: AppDeps['statusService'];
    costService: AppDeps['costService'];
  };
};

export const authenticatedApiRoutes = new Hono<AuthenticatedApiEnv>();

authenticatedApiRoutes.get('/me', (c) => {
  const auth = getAuthContext(c);
  return c.json({
    tokenId: auth.tokenId,
    isAdmin: auth.isAdmin,
    gameInstanceIds: auth.gameInstanceIds,
  } satisfies MeResponse);
});

authenticatedApiRoutes.get('/servers', async (c) => {
  const repo = c.get('repo');
  const statusService = c.get('statusService');
  const { gameInstanceIds } = getAuthContext(c);

  const instances = await Promise.all(
    gameInstanceIds.map((id) => repo.getInstance(id)),
  );

  const views = await Promise.all(
    instances
      .filter((inst): inst is NonNullable<typeof inst> => inst !== null)
      .map((inst) => statusService.buildServerView(inst)),
  );

  return c.json({ servers: views } satisfies ListServersResponse);
});

authenticatedApiRoutes.get('/servers/:id/status', async (c) => {
  const repo = c.get('repo');
  const statusService = c.get('statusService');
  const { gameInstanceIds } = getAuthContext(c);
  const id = c.req.param('id');

  if (!gameInstanceIds.includes(id)) {
    return c.json({ error: 'Not authorized for this server' }, 403);
  }

  const instance = await repo.getInstance(id);
  if (!instance) {
    return c.json({ error: 'Server not found' }, 404);
  }

  const view = await statusService.buildServerView(instance);
  return c.json({ server: view } satisfies ServerStatusResponse);
});

authenticatedApiRoutes.get('/servers/:id/cost', async (c) => {
  const repo = c.get('repo');
  const costService = c.get('costService');
  const { gameInstanceIds } = getAuthContext(c);
  const id = c.req.param('id');

  if (!gameInstanceIds.includes(id)) {
    return c.json({ error: 'Not authorized for this server' }, 403);
  }

  const instance = await repo.getInstance(id);
  if (!instance) {
    return c.json({ error: 'Server not found' }, 404);
  }

  try {
    const estimate = await costService.estimateHourlyCosts(instance);
    return c.json({ serverId: id, estimate } satisfies ServerCostResponse);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Failed to compute cost estimate', {
      instanceId: id,
      error: detail,
    });
    return c.json(
      { error: 'Failed to compute cost estimate', detail },
      502,
    );
  }
});

authenticatedApiRoutes.get('/servers/:id/ping', async (c) => {
  const repo = c.get('repo');
  const statusService = c.get('statusService');
  const { gameInstanceIds } = getAuthContext(c);
  const id = c.req.param('id');

  if (!gameInstanceIds.includes(id)) {
    return c.json({ error: 'Not authorized for this server' }, 403);
  }

  const instance = await repo.getInstance(id);
  if (!instance) {
    return c.json({ error: 'Server not found' }, 404);
  }

  try {
    const view = await statusService.buildServerView(instance);
    if (!view.healthEndpoint) {
      return c.json({
        serverId: id,
        ok: false,
        latencyMs: null,
      } satisfies ServerPingResponse);
    }

    // Health sidecar is plain HTTP. The browser cannot reliably probe this
    // (mixed content / TLS), so the API does it and returns a small result.
    const url = view.healthEndpoint.replace(/\/+$/, '') + '/ping';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      return c.json({
        serverId: id,
        ok: res.ok,
        latencyMs,
        statusCode: res.status,
      } satisfies ServerPingResponse);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Failed to ping server health endpoint', {
      instanceId: id,
      error: detail,
    });
    return c.json(
      { error: 'Failed to ping server health endpoint', detail },
      502,
    );
  }
});

authenticatedApiRoutes.post('/servers/:id/power', async (c) => {
  const repo = c.get('repo');
  const statusService = c.get('statusService');
  const { gameInstanceIds } = getAuthContext(c);
  const id = c.req.param('id');

  if (!gameInstanceIds.includes(id)) {
    return c.json({ error: 'Not authorized for this server' }, 403);
  }

  let body: TransitionRequest;
  try {
    body = await c.req.json<TransitionRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (body.action !== 'on' && body.action !== 'off') {
    return c.json({ error: 'Invalid action, must be "on" or "off"' }, 400);
  }

  const instance = await repo.getInstance(id);
  if (!instance) {
    return c.json({ error: 'Server not found' }, 404);
  }

  let current: ServerView;
  try {
    current = await statusService.buildServerView(instance);
  } catch (error) {
    console.error('Failed to build current server view before transition', {
      instanceId: id,
      action: body.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: 'Unable to read current server status' }, 502);
  }

  if (body.action === 'on' && current.status === 'online') {
    return c.json({ error: 'Server is already online' }, 409);
  }
  if (body.action === 'off' && current.status === 'offline') {
    return c.json({ error: 'Server is already offline' }, 409);
  }

  try {
    await statusService.startTransition(instance, body.action);
  } catch (error) {
    console.error('Failed to start transition', {
      instanceId: id,
      action: body.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: 'Failed to start transition' }, 502);
  }

  let view: ServerView;
  try {
    view = await statusService.buildServerView(instance);
  } catch (error) {
    console.error('Failed to build server view after transition start', {
      instanceId: id,
      action: body.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: 'Transition started, but status refresh failed' }, 502);
  }

  return c.json({ server: view } satisfies TransitionResponse);
});
