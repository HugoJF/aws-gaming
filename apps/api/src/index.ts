import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.get('/', (c) => {
  return c.json({ service: 'aws-gaming-api' });
});

export { app };
export const handler = handle(app);
