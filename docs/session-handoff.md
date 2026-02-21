# AWS Gaming - Session Handoff

> Historical note: This handoff document is preserved for context and may be stale. Use `docs/operations-architecture.md` for current architecture/operations.

Last updated: 2026-02-11

## 1) Confirmed decisions

- Monorepo using Bun workspaces.
- Terraform is single-environment oriented (default workspace model).
- Deploy region should be configurable; target region is `sa-east-1`.
- Frontend stack: Vite + React + Tailwind CSS v3 + shadcn/ui components.
- Backend stack: Hono, deployed to AWS Lambda with Function URL (no API Gateway).
- Terraform state backend: S3 + DynamoDB locking.
- Auth approach: random opaque tokens, delivered via magic URL (`/t/<token>`), persisted to localStorage, always visible in URL.
- Token behavior: expiration + revocation.
- DNS updater pattern: Route53 updated by API Lambda during boot/shutdown (not EventBridge).
- Latency: measured by browser pinging a health sidecar HTTP endpoint on EC2 via game DNS name.
- CI/CD: GitHub Actions.
- Migration baseline: fresh deployment (no existing resources to import).
- Dependency policy: install only what is needed; avoid pre-installing future libs.

## 2) What has been implemented

### Monorepo scaffold

- Root workspace/scripts/config:
  - `package.json` (fixed `dev:web`/`dev:api` scripts to use `--cwd`)
  - `bunfig.toml`
  - `tsconfig.base.json`
  - `tsconfig.json`
- Dependency policy document:
  - `docs/dependency-preferences.md`
- CI workflow:
  - `.github/workflows/ci.yml`

### Apps

- API scaffold with Hono Lambda handler:
  - `apps/api/src/index.ts`
- Web — full dashboard UI (Vite + React + Tailwind):
  - `apps/web/src/main.tsx` — React entrypoint
  - `apps/web/src/App.tsx` — dashboard shell with auth gating, server list, mock data
  - `apps/web/src/styles.css` — Tailwind globals with dark theme CSS variables
  - `apps/web/index.html` — Google Fonts (Inter + JetBrains Mono), theme color
  - `apps/web/tailwind.config.ts` — full shadcn/ui theme (HSL variables, custom fonts, animations)
  - `apps/web/postcss.config.mjs` — Tailwind + Autoprefixer
  - `apps/web/vite.config.ts` — `@/` path alias
  - `apps/web/tsconfig.json` — `paths` for `@/*` resolution
- Design reference app (Next.js, not part of build):
  - `apps/design/` — original Next.js prototype, migrated to `apps/web`

### Web components

- `src/components/server-card.tsx` — game server card with per-game accent colors, status badge with health check HoverCard (includes "last updated" footer), power toggle, info chips (players, location, IP), latency indicator, boot/shutdown sequence
- `src/components/boot-sequence.tsx` — presentational terminal-style boot/shutdown animation, accepts `type` + `stages` props (stage status: `pending | in_progress | completed | failed`), no internal timers
- `src/components/power-toggle.tsx` — circular power button with glow/spin states
- `src/components/dashboard-header.tsx` — header with server count + online count stats
- `src/components/empty-state.tsx` — shown when user has access to zero servers
- `src/components/unauthed-screen.tsx` — shown when no token; explains app, offers manual token entry
- `src/components/ui/badge.tsx` — shadcn Badge component
- `src/components/ui/hover-card.tsx` — shadcn HoverCard component

### Web hooks

- `src/hooks/use-auth.ts` — token lifecycle: extracts from `/t/<token>` URL, persists to localStorage, keeps URL in sync, login/logout, cross-tab sync
- `src/hooks/use-relative-time.ts` — live "Xs ago" string, re-ticks every 5s

### Web utilities

- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### Web dependencies

- Runtime: `react`, `react-dom`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `@radix-ui/react-hover-card`, `@radix-ui/react-slot`, `tailwindcss-animate`
- Dev: `tailwindcss@3.4.17`, `postcss`, `autoprefixer`, `vite`, `@vitejs/plugin-react`, TypeScript types

### Shared packages (minimal)

- Contracts: `packages/contracts/src/index.ts` (added `exports` field to package.json)
- Config helpers: `packages/config/src/index.ts`
- Opaque token helpers: `packages/auth-links/src/index.ts`
- AWS control interfaces: `packages/aws-control/src/index.ts`

### Terraform implemented (working baseline)

- `infra/terraform/modules/platform`
  - VPC, IGW, public subnets, route table/associations, ECS cluster.
- `infra/terraform/modules/game-service`
  - Security group + ingress rules.
  - IAM role/profile for ECS EC2 instances.
  - Launch Template (ECS AMI from SSM).
  - Auto Scaling Group (fixed desired=min=max to preserve one-switch behavior).
  - ECS task definition + ECS service.
  - Optional health sidecar support (`health_sidecar_image`, `health_port`) with SG ingress rule.
- `infra/terraform/modules/api`
  - API Lambda function (zip artifact deploy).
  - Lambda Function URL + CORS config.
  - IAM role/policy for DynamoDB + ECS/ASG/EC2 + optional Route53 updates.
  - DynamoDB single-table backend (`pk`/`sk`, TTL on `ttl`).
- `infra/terraform/stack`
  - Variable schema for per-game instances + API module inputs.
  - Module wiring from platform -> game service -> api.
  - Outputs for platform, game services, and API.
  - `hello-world.tfvars.example` for first deployment.
  - `backend.hcl.example` for S3/DynamoDB backend config.
- Terraform docs:
  - `infra/terraform/README.md` with Lambda packaging + init/plan/apply flow.

### Documentation

- `docs/api-layer-plan.md` — detailed API design (endpoints, polling, health checks, boot/shutdown sequences, DynamoDB schema, contracts expansion, implementation order). Includes open questions on admin handling, failure UX, auto-shutdown, and empty state.

### Validation status

- `bun run typecheck`: passing (note: `apps/design` excluded, lacks typecheck script).
- `bun run build`: passing (note: `apps/design` excluded, lacks build script compatible with workspace).
- `bun run build:api:lambda`: passing (creates `apps/api/dist/lambda.zip`).
- `bun run tf:validate`: passing.
- `terraform plan` against hello-world config was validated in a temporary local-backend copy.

## 3) Pending work (high priority)

See `docs/api-layer-plan.md` for the full implementation plan. Summary:

1. Expand `packages/contracts/src/index.ts` with full type system (GameType, ServerStatus, HealthCheck, PowerAction/PowerStage, ServerView, API types).

2. Implement `packages/aws-control/src/index.ts` with real AWS SDK calls:
   - ASG: describeAutoScalingGroups, setDesiredCapacity, updateAutoScalingGroup.
   - ECS: describeServices, updateService, listContainerInstances.
   - EC2: describeInstances (get public IP for DNS).
   - Route53: changeResourceRecordSets, listResourceRecordSets.

3. Implement API layer (`apps/api/`):
   - DynamoDB repository (`src/db/repository.ts`).
   - GameDig service wrapper (`src/services/gamedig.ts`).
   - Status assembly + power state machine (`src/services/status.ts`).
   - Auth middleware (`src/middleware/auth.ts`).
   - Hono routes: `GET /api/servers`, `GET /api/servers/:id/status`, `POST /api/servers/:id/power`.

4. Build health sidecar image (tiny HTTP `GET /ping` with CORS).

5. Wire frontend to real API:
   - Replace mock data with API calls.
   - Add `useServerPolling` hook with adaptive intervals.
   - Add `useLatencyPing` hook (browser pings health sidecar).

## 4) Pending work (medium priority)

1. Terraform hardening:
   - Consider optional private subnets/NAT path for future tightening.
   - Add CloudWatch log group conventions and retention.
   - Add alarms for ASG/ECS service health.
   - Add lifecycle/meta-arguments where needed for safer updates.

2. CI/CD expansion:
   - Add Terraform plan in PR with clear diff artifact.
   - Add deployment workflow (manual approval gates for apply).
   - Add API/web build-and-deploy jobs.

3. Admin handling (see open questions in `docs/api-layer-plan.md`).

## 5) Pending work (low priority)

1. Tests:
   - Unit tests for token helpers.
   - API endpoint tests.
   - Minimal integration tests for power control paths.

2. Repo quality:
   - Add conventional commit or PR templates.
   - Add architecture decision records if desired.

## 6) Immediate next-step checklist (recommended order)

1. Expand contracts with full type system.
2. Implement aws-control with real AWS SDK calls.
3. Implement DynamoDB repository layer.
4. Implement GameDig service wrapper.
5. Implement status assembly + power state machine.
6. Implement auth middleware + Hono routes.
7. Build/publish health sidecar image and set `health_sidecar_image` in tfvars.
8. Wire frontend to real API with polling hooks.
9. Add CI deploy workflows and guarded apply pipeline.

## 7) Useful commands

From repo root:

```bash
bun install
bun run typecheck
bun run build
bun run build:api:lambda
bun run dev:web
bun run dev:api
bun run tf:fmt
bun run tf:validate
```

For hello-world infra deploy:

```bash
cp infra/terraform/stack/backend.hcl.example infra/terraform/stack/backend.hcl
cp infra/terraform/stack/hello-world.tfvars.example infra/terraform/stack/hello-world.tfvars

# edit backend.hcl with real bucket/table
bun run tf:init
bun run tf:plan:hello
bun run tf:apply:hello
```

Destroy hello-world stack:

```bash
bun run tf:destroy:hello
```
