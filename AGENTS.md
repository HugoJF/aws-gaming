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

## Frontend ClassName Rules

- Prefer object notation in `cn()` for long conditional class rules.
- Treat a rule as "long" when it has multiple condition branches or spans multiple lines.
- Keep simple one-condition class toggles concise when readability is already clear.

## Frontend Structure Rules

- Prefer `1 component = 1 file` for app components.
- Prefer `1 useQuery/useMutation = 1 file` for hooks.
- Avoid merged "dev-friendly" hooks that wrap multiple queries/mutations into one API; compose hooks in the consuming component instead.

## React Query Rules

- Keep `queryFn`/`mutationFn` focused on the API call itself.
- Do not put business logic (for example auth-status branching, fallback shaping, or domain decisions) inside `queryFn`/`mutationFn`.
- For token-gated queries, use `enabled` to gate execution; avoid `if (!token)` branches inside `queryFn`.
- Return data/error/loading from hooks via query/mutation result state; interpret status codes (for example `401/403`) outside query functions.

## Naming Rules

- User-facing product name should be `AWS Gaming` (not `ServerDeck`).

## Terraform Rules

- Never mutate AWS resources directly (for example `aws lambda update-function-code`, `aws ecs update-service`).
- All infra changes must go through Terraform.
- Common commands: `bun run tf:fmt`, `bun run tf:validate`, `bun run tf:plan:hello`, `bun run tf:apply:hello`.
