# @aws-gaming/web

React dashboard (Vite + Tailwind) for server status and power controls.

## Entry Points

- App root: `apps/web/src/App.tsx`
- Auth hook: `apps/web/src/hooks/use-auth.ts`

## Commands

From repo root:

```bash
bun run dev:web
bun run --cwd apps/web build
bun run --cwd apps/web typecheck
bun run --cwd apps/web preview
```

## API Target In Dev

- Set `VITE_API_URL` to point the web app directly at a deployed API.
- Or set `VITE_DEV_API_PROXY_TARGET` to control Vite proxy target for `/api` and `/health`.
- If neither is set, dev proxy falls back to `http://localhost:3000`.
