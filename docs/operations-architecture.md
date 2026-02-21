# Operations And Architecture

Last updated: 2026-02-21

This is the primary, current-state architecture and operations reference for this repository.

## System Overview

- `apps/web`:
  - React + Vite dashboard.
  - Uses TanStack Query for data fetching/mutations.
  - Uses `react-router-dom` for route state (`/`, `/bootstrap`, `/t/:token`).
- `apps/api`:
  - Hono API on AWS Lambda Function URL.
  - Entry point: `apps/api/src/index.ts`.
  - Route modules:
    - `apps/api/src/routes/bootstrap.ts`
    - `apps/api/src/routes/authenticated-api.ts`
    - `apps/api/src/routes/admin.ts`
- `infra/terraform`:
  - `modules/platform`: VPC/network + ECS cluster.
  - `modules/game-service`: per-instance ECS-on-EC2 + always-on health sidecar.
  - `modules/api`: Lambda, Function URL, DynamoDB, IAM.
  - `stack`: environment composition and instance seeding.

## Runtime Data Flow

1. Browser authenticates with opaque token.
2. API validates bearer token against DynamoDB.
3. API reads instance metadata from DynamoDB and live state from AWS services.
4. API returns server view models for list/status/cost/ping/power routes.
5. Browser polls and renders state; browser can also probe health-sidecar endpoints.

## API Surface (Current)

Public:
- `GET /health`
- `GET /api/bootstrap/status`
- `POST /api/bootstrap/admin`

Authenticated:
- `GET /api/me`
- `GET /api/servers`
- `GET /api/servers/:id/status`
- `GET /api/servers/:id/cost`
- `GET /api/servers/:id/ping`
- `POST /api/servers/:id/power`

Admin (requires admin token):
- `GET /api/admin/tokens`
- `POST /api/admin/tokens`
- `PATCH /api/admin/tokens/:id`
- `POST /api/admin/tokens/:id/revoke`
- `GET /api/admin/servers`
- `GET /api/admin/instances` (backward compatibility)

## Authentication Model

- Opaque bearer token.
- Token source precedence:
  1. URL token path (`/t/:token`)
  2. localStorage persisted token
- Token records are stored in DynamoDB and include expiration/revocation/admin scope.

## DynamoDB Ownership

See `docs/dynamodb.md` for setup, schema, ownership, and operational workflows.

Summary:
- Terraform manages table infrastructure and game instance seed records.
- API manages runtime entities (tokens, transitions, status cache).

## Terraform Ownership And Rules

- Infra changes go through Terraform only.
- Do not mutate managed AWS resources directly.
- Validation command: `bun run tf:validate`.

## Common Operations

Local development:
- `bun install`
- `bun run dev:api`
- `bun run dev:web`

Build and checks:
- `bun run build`
- `bun run typecheck`
- `make api-lambda`
- `bun run tf:validate`

Deploy (`hello-world` stack profile):
- `make tf-init`
- `make tf-plan`
- `make tf-apply`
- `make tf-output-api-url`

## Operational Notes

- Health sidecar is always enabled in `modules/game-service`.
- API Function URL auth type is hardcoded to `NONE`.
- Existing known issue tracked in `docs/TODO.md`:
  - `GET https://minecraft.aws.hugo.dev.br:8080/ping` TLS/protocol error.

## Source-Of-Truth Docs

Current docs:
- `docs/operations-architecture.md` (this file)
- `docs/dynamodb.md`
- `infra/terraform/README.md`
- `README.md`
- `docs/TODO.md` / `docs/BUGS.md`

Historical planning docs (not canonical for current behavior):
- `docs/session-handoff.md`
- `docs/api-layer-plan.md`
- `docs/admin-api-plan.md`
- `docs/cost-tracking.md`
