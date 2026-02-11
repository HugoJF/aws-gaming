# aws-gaming

Game server control plane monorepo:
- API: Hono on AWS Lambda (Function URL)
- Web: Vite + React dashboard
- Infra: Terraform (ECS on EC2 + API Lambda + DynamoDB)

## Readme Index

- `apps/README.md`
- `apps/api/README.md`
- `apps/web/README.md`
- `packages/README.md`
- `packages/contracts/README.md`
- `packages/config/README.md`
- `packages/auth-links/README.md`
- `packages/aws-control/README.md`
- `infra/README.md`
- `infra/terraform/README.md`

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
# workspace build/typecheck (note: apps/design is intentionally excluded from root scripts)
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
  --billing-mode PAY_PER_REQUEST
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
2. If no tokens exist yet, the unauth screen exposes one-time admin bootstrap.
3. Create the initial admin token in UI. The app will log in automatically.
4. If bootstrap is already complete, use a token URL (`/t/<token>`) or paste a raw token.

Related bootstrap endpoints (public, one-time guarded):
- `GET /api/bootstrap/status`
- `POST /api/bootstrap/admin`

## Destroy

```bash
make tf-destroy
```
