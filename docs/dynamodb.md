# DynamoDB Setup And Management

This project uses DynamoDB for two different purposes:

1. Terraform state locking (backend lock table).
2. Runtime API data (game instances, tokens, transitions, cached status).

## 1) Terraform Backend Lock Table

This is the lock table used by Terraform itself, not by the application runtime.

- Table name (current setup): `hugo-aws-gaming-tf-locks`
- Key schema: hash key `LockID` (string)
- Billing mode: `PAY_PER_REQUEST`
- Used by: `infra/terraform/stack/backend.hcl`

Bootstrap command example is documented in:
- `README.md`
- `infra/terraform/README.md`

## 2) Application Runtime Table

This is the table used by the API Lambda and repository layer.

Provisioning:
- Terraform resource: `infra/terraform/modules/api/main.tf` (`aws_dynamodb_table.api`)
- Default table name: `<project>-<environment>`
- Optional override: `api_dynamodb_table_name` (`infra/terraform/stack/variables.tf`)

Table settings:
- Partition key: `pk` (string)
- Sort key: `sk` (string)
- Billing mode: `PAY_PER_REQUEST`
- TTL attribute: `ttl` (enabled)

API wiring:
- Lambda receives table name via `DYNAMODB_TABLE_NAME` env var
- Set in Terraform module API lambda environment
- Read in code at `apps/api/src/app-deps.ts`

## Ownership Model

- Infrastructure ownership: Terraform manages table lifecycle, config, IAM.
- Data ownership:
  - Game instance records are seeded/updated by Terraform (`aws_dynamodb_table_item.game_instance` in `infra/terraform/stack/main.tf`).
  - Tokens are managed by API endpoints (`/api/bootstrap/*`, `/api/admin/tokens*`).
  - Transition/cache records are managed by API runtime logic.

Do not manually mutate application records in AWS console as a normal workflow. Prefer Terraform for infra/seeded instance records and API endpoints for token/admin/runtime behavior.

## Entity Shapes And Keys

Current repository key patterns (see `apps/api/src/db/repository.ts`):

- `GameInstance`
  - `pk = INSTANCE#{id}`
  - `sk = INSTANCE`
  - Seeded by Terraform.

- `SecretAccessToken`
  - `pk = TOKEN#{tokenHash}`
  - `sk = TOKEN`
  - Created/revoked via API.

- `TransitionIntent`
  - `pk = INSTANCE#{id}`
  - `sk = TRANSITION`
  - Runtime power transition intent.
  - Uses TTL (`ttl`) set to `now + 24h`.

- `CachedServerStatus`
  - `pk = INSTANCE#{id}`
  - `sk = STATUS_CACHE`
  - Runtime status cache.
  - Uses TTL (`ttl`) set to `now + 1h`.

- `GameTemplate` (supported by repository methods)
  - `pk = TEMPLATE#{id}`
  - `sk = TEMPLATE`

## Common Operations

### Add or change game instances

1. Edit `game_instances` in `infra/terraform/stack/*.tfvars`.
2. Run Terraform plan/apply.
3. Terraform updates the seeded `GameInstance` items.

### Create first admin token

Use bootstrap flow:
- `GET /api/bootstrap/status`
- `POST /api/bootstrap/admin`

### Manage tokens

Use admin API:
- `GET /api/admin/tokens`
- `POST /api/admin/tokens`
- `PATCH /api/admin/tokens/:id`
- `POST /api/admin/tokens/:id/revoke`

## IAM Scope

Lambda policy includes DynamoDB actions for the runtime table and indexes:
- `BatchGetItem`, `BatchWriteItem`, `DeleteItem`, `GetItem`, `PutItem`, `Query`, `Scan`, `UpdateItem`

Defined in `infra/terraform/modules/api/main.tf` (`data.aws_iam_policy_document.lambda_permissions`).

## Validation Checklist

- Run `bun run tf:validate` after Terraform changes.
- Confirm table output with:
  - `terraform -chdir=infra/terraform/stack output api_dynamodb_table_name`
- Confirm API Lambda env points to the expected table (`DYNAMODB_TABLE_NAME`).
