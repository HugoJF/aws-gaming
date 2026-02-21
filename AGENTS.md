# AGENTS

## Commit Messages

- Use Conventional Commits for all commits: `type(scope): subject`.
- Before the first commit in a session, check recent history with `git log --oneline -n 10` and match the project pattern.

## Project Stack

- Monorepo managed with Bun workspaces.
- Web app: React + Vite + TanStack Query (`apps/web`).
- API: Hono on Bun (`apps/api`).
- Infrastructure: Terraform (`infra/terraform`).
- Do not add Bun/WebSocket/Bun.serve patterns unless explicitly requested; they are not current project defaults.

## Development Commands

- Start API: `bun run dev:api`
- Start web: `bun run dev:web`
- Build all: `bun run build`
- Typecheck all: `bun run typecheck`
- Build API Lambda artifact: `bun run build:api:lambda`

## Terraform Rules

- Never mutate AWS resources directly (for example `aws lambda update-function-code`, `aws ecs update-service`).
- All infra changes must go through Terraform.
- Common commands: `bun run tf:fmt`, `bun run tf:validate`, `bun run tf:plan:hello`, `bun run tf:apply:hello`.
