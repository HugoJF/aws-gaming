# @aws-gaming/api

Hono API deployed as AWS Lambda Function URL.

## Entry Points

- Source: `apps/api/src/index.ts`
- Lambda handler export: `handler`
- Local routes now: `GET /`, `GET /health`

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
