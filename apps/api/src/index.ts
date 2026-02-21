import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/aws-lambda';
import { createAppDeps } from './app-deps.js';
import { createBootstrapRoutes } from './routes/bootstrap.js';
import { createAuthenticatedApiRoutes } from './routes/authenticated-api.js';

const deps = createAppDeps();

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
app.route('/api/bootstrap', createBootstrapRoutes(deps));

/* Auth-protected API routes */
app.route('/api', createAuthenticatedApiRoutes(deps));

export { app };
export const handler = handle(app);
