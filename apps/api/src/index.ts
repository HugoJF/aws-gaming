import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/aws-lambda';
import { createAppDeps, type AppDeps } from './app-deps.js';
import { bootstrapRoutes } from './routes/bootstrap.js';
import { authenticatedApiRoutes } from './routes/authenticated-api.js';
import { adminRoutes } from './routes/admin.js';

const deps = createAppDeps();

type AppEnv = {
  Variables: {
    repo: AppDeps['repo'];
    statusService: AppDeps['statusService'];
    costService: AppDeps['costService'];
  };
};

const app = new Hono<AppEnv>();

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
app.use('/api/bootstrap/*', async (c, next) => {
  c.set('repo', deps.repo);
  await next();
});
app.route('/api/bootstrap', bootstrapRoutes);

/* Auth-protected API routes */
app.use('/api/*', deps.authMiddleware);
app.use('/api/*', async (c, next) => {
  c.set('repo', deps.repo);
  c.set('statusService', deps.statusService);
  c.set('costService', deps.costService);
  await next();
});
app.use('/api/admin/*', deps.adminMiddleware);
app.route('/api', authenticatedApiRoutes);
app.route('/api/admin', adminRoutes);

export { app };
export const handler = handle(app);
