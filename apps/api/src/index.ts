import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/aws-lambda';
import { createOpaqueToken, hashOpaqueToken, computeTokenStatus } from '@aws-gaming/auth-links';
import type {
  ListServersResponse,
  ServerStatusResponse,
  ServerCostResponse,
  PowerRequest,
  PowerResponse,
  MeResponse,
  AdminListTokensResponse,
  AdminCreateTokenResponse,
  AdminUpdateTokenResponse,
  AdminRevokeTokenResponse,
  AdminListServersResponse,
  AdminListInstancesResponse,
  AdminTokenView,
  PowerAction,
  ServerView,
  SecretAccessToken,
  BootstrapStatusResponse,
  BootstrapCreateAdminResponse,
} from '@aws-gaming/contracts';
import { AsgControl, EcsControl, Ec2Control, DnsControl } from '@aws-gaming/aws-control';
import { Repository } from './db/repository.js';
import { StatusService } from './services/status.js';
import { CostService } from './services/cost.js';
import {
  createAuthMiddleware,
  createAdminMiddleware,
  getAuthContext,
} from './middleware/auth.js';

/* ------------------------------------------------------------------ */
/*  Config from environment                                            */
/* ------------------------------------------------------------------ */

const TABLE_NAME =
  process.env.DYNAMODB_TABLE_NAME ??
  process.env.DYNAMODB_TABLE ??
  'aws-gaming-dev';
const REGION = process.env.AWS_REGION ?? 'sa-east-1';

/* ------------------------------------------------------------------ */
/*  Service wiring                                                     */
/* ------------------------------------------------------------------ */

const repo = new Repository(TABLE_NAME, REGION);
const statusService = new StatusService(
  repo,
  new AsgControl(REGION),
  new EcsControl(REGION),
  new Ec2Control(REGION),
  new DnsControl(REGION),
);
const costService = new CostService(REGION);
const authMiddleware = createAuthMiddleware(repo);
const adminMiddleware = createAdminMiddleware();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toAdminTokenView(token: SecretAccessToken): AdminTokenView {
  return {
    id: token.id,
    label: token.label?.trim() || token.id,
    tokenPrefix: token.tokenHash.slice(0, 8),
    status: computeTokenStatus(token.expiresAt, token.revokedAt),
    instanceIds: token.gameInstanceIds,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    isAdmin: token.isAdmin,
  };
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

function normalizeExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function unknownInstanceIds(instanceIds: string[], knownIds: Set<string>): string[] {
  return instanceIds.filter((id) => !knownIds.has(id));
}

async function canBootstrapAdmin(): Promise<boolean> {
  const tokens = await repo.listTokens();
  return tokens.length === 0;
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

const app = new Hono();

app.onError((err, c) => {
  console.error('Unhandled API error', {
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.message : String(err),
  });
  return c.json({ error: 'Internal server error' }, 500);
});

// Lambda Function URL already applies CORS at the edge.
// Keep Hono CORS only for non-Lambda local runtime paths.
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use('*', cors());
}

/* Health (no auth) */
app.get('/health', (c) => c.json({ status: 'ok' }));

/* One-time bootstrap routes (no auth) */
app.get('/api/bootstrap/status', async (c) => {
  return c.json({
    canBootstrap: await canBootstrapAdmin(),
  } satisfies BootstrapStatusResponse);
});

app.post('/api/bootstrap/admin', async (c) => {
  if (!(await canBootstrapAdmin())) {
    return c.json({ error: 'Bootstrap already completed' }, 409);
  }

  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'JSON body must be an object' }, 400);
  }

  const input = body as Record<string, unknown>;
  const label =
    typeof input.label === 'string' && input.label.trim().length > 0
      ? input.label.trim()
      : 'Initial admin';

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

/* Auth-protected API routes */
const api = new Hono();
api.use('*', authMiddleware);

api.get('/me', (c) => {
  const auth = getAuthContext(c);
  return c.json({
    tokenId: auth.tokenId,
    isAdmin: auth.isAdmin,
    gameInstanceIds: auth.gameInstanceIds,
  } satisfies MeResponse);
});

/* GET /api/servers — list all authorized servers */
api.get('/servers', async (c) => {
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

/* GET /api/servers/:id/status — single server status (poll target) */
api.get('/servers/:id/status', async (c) => {
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

/* GET /api/servers/:id/cost — hourly online/offline estimate */
api.get('/servers/:id/cost', async (c) => {
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

/* POST /api/servers/:id/power — power on/off */
api.post('/servers/:id/power', async (c) => {
  const { gameInstanceIds } = getAuthContext(c);
  const id = c.req.param('id');

  if (!gameInstanceIds.includes(id)) {
    return c.json({ error: 'Not authorized for this server' }, 403);
  }

  let body: PowerRequest;
  try {
    body = await c.req.json<PowerRequest>();
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
    console.error('Failed to build current server view before power action', {
      instanceId: id,
      action: body.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: 'Unable to read current server status' }, 502);
  }

  // Check for conflicting states
  if (body.action === 'on' && current.status === 'online') {
    return c.json({ error: 'Server is already online' }, 409);
  }
  if (body.action === 'off' && current.status === 'offline') {
    return c.json({ error: 'Server is already offline' }, 409);
  }
  if (current.status === 'booting' || current.status === 'shutting-down') {
    return c.json({ error: 'Power transition already in progress' }, 409);
  }

  let powerAction: PowerAction;
  try {
    powerAction = await statusService.startPowerAction(instance, body.action);
  } catch (error) {
    console.error('Failed to start power action', {
      instanceId: id,
      action: body.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: 'Failed to start power action' }, 502);
  }

  let view: ServerView;
  try {
    view = await statusService.buildServerView(instance);
  } catch (error) {
    console.error('Failed to build server view after power action start', {
      instanceId: id,
      action: body.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: 'Power action started, but status refresh failed' }, 502);
  }
  const transitionalStatus = body.action === 'on' ? 'booting' : 'shutting-down';

  return c.json({
    server: {
      ...view,
      status: transitionalStatus,
      powerAction,
      lastUpdatedAt: new Date().toISOString(),
    },
  } satisfies PowerResponse);
});

/* Admin API routes */
const admin = new Hono();
admin.use('*', adminMiddleware);

admin.get('/tokens', async (c) => {
  const tokens = await repo.listTokens();
  const views = tokens
    .map((token) => toAdminTokenView(token))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({ tokens: views } satisfies AdminListTokensResponse);
});

admin.post('/tokens', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'JSON body must be an object' }, 400);
  }
  const input = body as Record<string, unknown>;

  const label =
    typeof input.label === 'string'
      ? input.label.trim()
      : '';
  if (!label) {
    return c.json({ error: 'label is required' }, 400);
  }

  const instanceIds = input.instanceIds;
  if (!isNonEmptyStringArray(instanceIds)) {
    return c.json({ error: 'instanceIds must be a non-empty array of strings' }, 400);
  }

  const expiresAt = normalizeExpiresAt(input.expiresAt);
  if (expiresAt === undefined && input.expiresAt !== undefined) {
    return c.json({ error: 'expiresAt must be an ISO date string or null' }, 400);
  }

  const isAdmin = input.isAdmin;
  if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
    return c.json({ error: 'isAdmin must be boolean when provided' }, 400);
  }

  const knownIds = new Set((await repo.listInstances()).map((instance) => instance.id));
  const unknownIds = unknownInstanceIds(instanceIds, knownIds);
  if (unknownIds.length > 0) {
    return c.json(
      { error: `Unknown instance IDs: ${unknownIds.join(', ')}` },
      400,
    );
  }

  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const token: SecretAccessToken = {
    id: `tok_${crypto.randomUUID().slice(0, 8)}`,
    tokenHash,
    label,
    gameInstanceIds: instanceIds,
    expiresAt: expiresAt ?? null,
    isAdmin,
    createdAt: new Date().toISOString(),
  };

  await repo.putToken(token);

  return c.json(
    {
      token: toAdminTokenView(token),
      rawToken,
    } satisfies AdminCreateTokenResponse,
    201,
  );
});

admin.patch('/tokens/:id', async (c) => {
  const id = c.req.param('id');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'JSON body must be an object' }, 400);
  }
  const input = body as Record<string, unknown>;

  const patch: Partial<
    Pick<SecretAccessToken, 'label' | 'gameInstanceIds' | 'expiresAt' | 'isAdmin'>
  > = {};

  if ('label' in input) {
    const labelValue = input.label;
    if (typeof labelValue !== 'string' || labelValue.trim().length === 0) {
      return c.json({ error: 'label must be a non-empty string' }, 400);
    }
    patch.label = labelValue.trim();
  }

  if ('instanceIds' in input) {
    const instanceIds = input.instanceIds;
    if (!isNonEmptyStringArray(instanceIds)) {
      return c.json({ error: 'instanceIds must be a non-empty array of strings' }, 400);
    }

    const knownIds = new Set((await repo.listInstances()).map((instance) => instance.id));
    const unknownIds = unknownInstanceIds(instanceIds, knownIds);
    if (unknownIds.length > 0) {
      return c.json(
        { error: `Unknown instance IDs: ${unknownIds.join(', ')}` },
        400,
      );
    }

    patch.gameInstanceIds = instanceIds;
  }

  if ('expiresAt' in input) {
    const expiresAt = normalizeExpiresAt(input.expiresAt);
    if (expiresAt === undefined && input.expiresAt !== undefined) {
      return c.json({ error: 'expiresAt must be an ISO date string or null' }, 400);
    }
    patch.expiresAt = expiresAt ?? null;
  }

  if ('isAdmin' in input) {
    const isAdmin = input.isAdmin;
    if (typeof isAdmin !== 'boolean') {
      return c.json({ error: 'isAdmin must be boolean' }, 400);
    }
    patch.isAdmin = isAdmin;
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'No mutable fields provided' }, 400);
  }

  const token = await repo.getTokenById(id);
  if (!token) {
    return c.json({ error: 'Token not found' }, 404);
  }

  const updated = await repo.updateTokenByHash(token.tokenHash, patch);
  if (!updated) {
    return c.json({ error: 'Token not found' }, 404);
  }

  return c.json(
    { token: toAdminTokenView(updated) } satisfies AdminUpdateTokenResponse,
  );
});

admin.post('/tokens/:id/revoke', async (c) => {
  const id = c.req.param('id');

  const token = await repo.getTokenById(id);
  if (!token) {
    return c.json({ error: 'Token not found' }, 404);
  }

  const revoked = await repo.revokeTokenByHash(
    token.tokenHash,
    new Date().toISOString(),
  );
  if (!revoked) {
    return c.json({ error: 'Token not found' }, 404);
  }

  return c.json(
    { token: toAdminTokenView(revoked) } satisfies AdminRevokeTokenResponse,
  );
});

async function listAdminServers() {
  const instances = await repo.listInstances();

  const views = (await Promise.all(
    instances.map(async (instance) => {
      const server = await statusService.buildServerView(instance);
      return {
        id: instance.id,
        displayName: instance.displayName,
        game: instance.gameType,
        gameLabel: instance.gameLabel,
        location: instance.location,
        status: server.status,
        address: server.address,
        maxPlayers: instance.maxPlayers,
      };
    }),
  ))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return views;
}

admin.get('/servers', async (c) => {
  return c.json(
    { servers: await listAdminServers() } satisfies AdminListServersResponse,
  );
});

// Backward compatibility for older clients.
admin.get('/instances', async (c) => {
  return c.json(
    { instances: await listAdminServers() } satisfies AdminListInstancesResponse,
  );
});

api.route('/admin', admin);
app.route('/api', api);

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export { app };
export const handler = handle(app);
