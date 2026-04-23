# aws-gaming

A self-hosted game server control plane that provisions AWS infrastructure and exposes a web dashboard for starting, stopping, and monitoring game servers. Supports Minecraft, Project Zomboid, and any generic server.

## Architecture

```
apps/
  api/        Hono API deployed as AWS Lambda (Function URL)
  web/        React + Vite dashboard (TanStack Query, React Router)
packages/
  contracts/  Shared TypeScript types between API and web
  config/     Environment variable helpers
  auth-links/ Token creation, hashing, and revocation
  aws-control/  ASG, ECS, EC2, and Route53 AWS SDK wrappers
infra/
  terraform/  Full infrastructure as code (ECS on EC2, Lambda, DynamoDB, VPC)
```

### Infrastructure

- **Lambda**: Hono API with a Function URL (no API Gateway)
- **ECS on EC2**: One Auto Scaling Group + ECS service per game server, with an always-on health sidecar
- **DynamoDB**: Token store and game instance metadata
- **Route53**: DNS record per game server (`<game>.aws.<domain>`)
- **S3 + DynamoDB**: Terraform remote state and locking

### API

Public endpoints:
- `GET /health`
- `GET /api/bootstrap/status`
- `POST /api/bootstrap/admin`

Authenticated (bearer token):
- `GET /api/me`
- `GET /api/servers`
- `GET /api/servers/:id/status`
- `GET /api/servers/:id/cost`
- `GET /api/servers/:id/ping`
- `POST /api/servers/:id/power`

Admin:
- `GET /api/admin/tokens`
- `POST /api/admin/tokens`
- `PATCH /api/admin/tokens/:id`
- `POST /api/admin/tokens/:id/revoke`
- `GET /api/admin/servers`

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| API framework | [Hono](https://hono.dev) |
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query |
| IaC | Terraform >= 1.6 |
| AWS services | Lambda, ECS, EC2, DynamoDB, Route53, ASG |
| Language | TypeScript (strict) |

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Terraform](https://developer.hashicorp.com/terraform) >= 1.6
- [AWS CLI](https://aws.amazon.com/cli/) configured for your target account and region
- `make`, `zip`

## Local Development

```bash
bun install

# Run API and web in separate terminals
bun run dev:api
bun run dev:web
```

The web app reads `VITE_API_URL` from `apps/web/.env.development.local`:

```
VITE_API_URL=https://<your-lambda-url>
```

## Build

```bash
# Typecheck all workspaces
bun run typecheck

# Build all workspaces
bun run build

# Package Lambda artifact (required before Terraform deploy)
make api-lambda
```

## Deployment

### 1. Bootstrap remote state (one-time)

```bash
aws s3api create-bucket \
  --bucket <your-tf-state-bucket> \
  --region <region> \
  --create-bucket-configuration LocationConstraint=<region>

aws dynamodb create-table \
  --table-name <your-tf-lock-table> \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region <region>
```

Update `infra/terraform/stack/backend.hcl` with your bucket and table names.

### 2. Configure game instances

Edit `infra/terraform/stack/hello-world.tfvars` to set your AWS region, Route53 zone, and define `game_instances`. Each instance specifies a container image, port, instance type, and game type (`minecraft`, `zomboid`, or `generic`).

### 3. Deploy

```bash
make api-lambda   # build Lambda zip
make tf-init      # init backend
make tf-plan      # preview changes
make tf-apply     # apply
make tf-output-api-url  # print deployed API URL
```

### 4. First access / admin bootstrap

1. Open the deployed web app.
2. First-time visitors are redirected to `/bootstrap`.
3. If no tokens exist, the bootstrap page lets you create the initial admin token.
4. Log in with that token. Share additional token URLs (`/t/<token>`) with other users.

## Supported Games

| Game | `game_type` | Notes |
|---|---|---|
| Minecraft (Java) | `minecraft` | Uses GameDig for player count |
| Project Zomboid | `zomboid` | Uses GameDig for player count |
| Any other server | `generic` | No GameDig health check |

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:

- Typecheck and build all workspaces (`bun`)
- Terraform format check and validation (no backend required)

## Terraform Targets

| Make target | Description |
|---|---|
| `make api-lambda` | Build Lambda artifact |
| `make tf-fmt` | Format Terraform files |
| `make tf-validate` | Validate Terraform (local backend) |
| `make tf-init` | Initialize remote backend |
| `make tf-plan` | Preview infrastructure changes |
| `make tf-apply` | Apply infrastructure changes |
| `make tf-destroy` | Destroy all managed infrastructure |

## Notes

- Never mutate AWS resources directly; always go through Terraform.
- Terraform detects Lambda code changes via `source_code_hash` and redeploys automatically on `tf-apply`.
- The health sidecar container runs alongside every game service to provide a stable ECS health target independent of game state.
