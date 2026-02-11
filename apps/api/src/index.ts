import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/aws-lambda';
import type {
  ListServersResponse,
  ServerStatusResponse,
  PowerRequest,
  PowerResponse,
} from '@aws-gaming/contracts';
import { AsgControl, EcsControl, Ec2Control, DnsControl } from '@aws-gaming/aws-control';
import { Repository } from './db/repository.js';
import { StatusService } from './services/status.js';
import { createAuthMiddleware, getAuthContext } from './middleware/auth.js';

/* ------------------------------------------------------------------ */
/*  Config from environment                                            */
/* ------------------------------------------------------------------ */

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'aws-gaming-dev';
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
const authMiddleware = createAuthMiddleware(repo);

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

const app = new Hono();

app.use('*', cors());

/* Health (no auth) */
app.get('/health', (c) => c.json({ status: 'ok' }));

/* Auth-protected API routes */
const api = new Hono();
api.use('*', authMiddleware);

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

/* POST /api/servers/:id/power — power on/off */
api.post('/servers/:id/power', async (c) => {
  const { gameInstanceIds } = getAuthContext(c);
  const id = c.req.param('id');

  if (!gameInstanceIds.includes(id)) {
    return c.json({ error: 'Not authorized for this server' }, 403);
  }

  const body = await c.req.json<PowerRequest>();
  if (body.action !== 'on' && body.action !== 'off') {
    return c.json({ error: 'Invalid action, must be "on" or "off"' }, 400);
  }

  const instance = await repo.getInstance(id);
  if (!instance) {
    return c.json({ error: 'Server not found' }, 404);
  }

  // Check for conflicting states
  if (body.action === 'on' && instance.state === 'online') {
    return c.json({ error: 'Server is already online' }, 409);
  }
  if (body.action === 'off' && instance.state === 'offline') {
    return c.json({ error: 'Server is already offline' }, 409);
  }
  if (instance.state === 'booting' || instance.state === 'shutting-down') {
    return c.json({ error: 'Power transition already in progress' }, 409);
  }

  const powerAction = await statusService.startPowerAction(instance, body.action);
  const view = await statusService.buildServerView({
    ...instance,
    state: body.action === 'on' ? 'booting' : 'shutting-down',
    powerAction,
  });

  return c.json({ server: view } satisfies PowerResponse);
});

app.route('/api', api);

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export { app };
export const handler = handle(app);
