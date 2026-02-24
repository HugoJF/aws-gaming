# aws-gaming

Game server control plane monorepo:
- API: Hono on AWS Lambda (Function URL)
- Web: Vite + React dashboard
- Infra: Terraform (ECS on EC2 + API Lambda + DynamoDB)

## Readme Index

| Directory | Description |
|-----------|-------------|
| [`apps/`](apps/README.md) | Application workspace root |
| [`apps/api/`](apps/api/README.md) | Hono API (Lambda) |
| [`apps/web/`](apps/web/README.md) | React dashboard (Vite) |
| [`packages/`](packages/README.md) | Shared packages root |
| [`packages/contracts/`](packages/contracts/README.md) | Shared TypeScript types |
| [`packages/config/`](packages/config/README.md) | Environment variable helpers |
| [`packages/auth-links/`](packages/auth-links/README.md) | Token creation, hashing, and revocation |
| [`packages/aws-control/`](packages/aws-control/README.md) | ASG, ECS, EC2, and Route53 wrappers |
| [`infra/`](infra/README.md) | Infrastructure root |
| [`infra/terraform/`](infra/terraform/README.md) | Terraform modules |
| [`docs/`](docs/README.md) | Documentation index |
| [`docs/operations-architecture.md`](docs/operations-architecture.md) | Canonical operations and architecture guide |
| [`docs/dynamodb.md`](docs/dynamodb.md) | DynamoDB setup and operational ownership |

## Prerequisites

- `bun` (workspace package manager + scripts)
- `terraform >= 1.6`
- `aws` CLI configured for target account/region
- `make`
- `zip` (for Lambda artifact packaging)

## Local Dev

```bash
bun install
bun run dev:api
bun run dev:web
```

## Build And Validate

```bash
# workspace build/typecheck
bun run build
bun run typecheck

# package Lambda artifact for Terraform deploy
make api-lambda

# Terraform formatting and validation
make tf-fmt
make tf-validate
```

## Deployment (Terraform Stack)

1. One-time remote-state backend bootstrap (if not already created):

```bash
aws s3api create-bucket \
  --bucket hugo-aws-gaming-tf-state-sa-east-1 \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1

aws dynamodb create-table \
  --table-name hugo-aws-gaming-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region sa-east-1
```

2. `infra/terraform/stack/backend.hcl` and `infra/terraform/stack/hello-world.tfvars` are committed for this personal setup.
3. Define shared platform settings and per-server `game_instances` in `infra/terraform/stack/hello-world.tfvars`.
4. Build API Lambda artifact:

```bash
make api-lambda
```

5. Initialize backend and deploy:

```bash
make tf-init
make tf-plan
make tf-apply
```

6. Read important outputs:

```bash
make tf-output-api-url
terraform -chdir=infra/terraform/stack output game_service_names
terraform -chdir=infra/terraform/stack output game_asg_names
```

## First Access / Admin Bootstrap

1. Open the deployed web app (or local web app pointing at deployed API URL).
2. First-time users hitting `/` are redirected to `/bootstrap`.
3. If no tokens exist yet, `/bootstrap` exposes one-time admin bootstrap.
4. Create the initial admin token in UI. The app will log in automatically.
5. If bootstrap is already complete, use a token URL (`/t/<token>`) or paste a raw token.

Related bootstrap endpoints (public, one-time guarded):
- `GET /api/bootstrap/status`
- `POST /api/bootstrap/admin`

## Supported Games

- `minecraft`
- `zomboid`
- `generic` (no GameDig checks)

## Destroy

```bash
make tf-destroy
```
