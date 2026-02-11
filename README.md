# aws-gaming

Game server control plane monorepo:
- API: Hono on AWS Lambda (Function URL)
- Web: Vite + React dashboard
- Infra: Terraform (ECS on EC2 + API Lambda + DynamoDB)

## Readme Index

- `apps/README.md`
- `apps/api/README.md`
- `apps/web/README.md`
- `apps/design/README.md`
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
bun run build:api:lambda

# Terraform formatting and validation
bun run tf:fmt
bun run tf:validate
```

## Deployment (Terraform Stack)

1. One-time remote-state backend bootstrap (if not already created):

```bash
aws s3api create-bucket \
  --bucket <state-bucket-name> \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1

aws dynamodb create-table \
  --table-name <terraform-lock-table> \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

2. Prepare stack config files:

```bash
cp infra/terraform/stack/backend.hcl.example infra/terraform/stack/backend.hcl
cp infra/terraform/stack/hello-world.tfvars.example infra/terraform/stack/hello-world.tfvars
```

3. Edit `infra/terraform/stack/backend.hcl` with your S3 state bucket and DynamoDB lock table.
4. Build API Lambda artifact:

```bash
bun run build:api:lambda
```

5. Initialize backend and deploy:

```bash
bun run tf:init
bun run tf:plan:hello
bun run tf:apply:hello
```

6. Read important outputs:

```bash
terraform -chdir=infra/terraform/stack output api_lambda_function_url
terraform -chdir=infra/terraform/stack output game_service_names
terraform -chdir=infra/terraform/stack output game_asg_names
```

## Destroy

```bash
bun run tf:destroy:hello
```
