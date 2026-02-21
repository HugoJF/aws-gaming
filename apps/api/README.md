# @aws-gaming/api

Hono API deployed as AWS Lambda Function URL.

## Entry Points

- Lambda entrypoint: `apps/api/src/index.ts`
- Lambda handler export: `handler`
- Route modules:
  - `apps/api/src/routes/bootstrap.ts`
  - `apps/api/src/routes/authenticated-api.ts`
  - `apps/api/src/routes/admin.ts`

Current endpoint surface is documented in `docs/operations-architecture.md`.

## Commands

From repo root:

```bash
bun run dev:api
bun run --cwd apps/api build
bun run --cwd apps/api typecheck
bun run build:api:lambda
```

Lambda artifact output:

- `apps/api/dist/lambda.zip`
