# Terraform

## Layout

- `modules/platform`: shared resources (VPC, public subnets, ECS cluster)
- `modules/game-service`: per-game ECS-on-EC2 resources (security group, ASG, task, service, optional health sidecar)
- `modules/api`: API resources (Lambda + Function URL + DynamoDB + IAM)
- `stack`: single environment entrypoint (default workspace)

## First deploy (hello world)

1. Create backend infrastructure (once):

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

2. Copy backend and stack variable examples:

```bash
cp infra/terraform/stack/backend.hcl.example infra/terraform/stack/backend.hcl
cp infra/terraform/stack/hello-world.tfvars.example infra/terraform/stack/hello-world.tfvars
```

3. Edit `infra/terraform/stack/backend.hcl` with your bucket/table names.

4. Build the API Lambda artifact:

```bash
bun run build:api:lambda
```

This creates `apps/api/dist/lambda.zip` (the default `api_lambda_zip_path` used by the stack).

5. Initialize and deploy:

```bash
terraform -chdir=infra/terraform/stack init -backend-config=backend.hcl
terraform -chdir=infra/terraform/stack plan -var-file=hello-world.tfvars
terraform -chdir=infra/terraform/stack apply -var-file=hello-world.tfvars
```

6. Get the instance public IP (for `hello-web`):

```bash
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters Name=tag:GameInstance,Values=hello-web Name=instance-state-name,Values=running \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

Then open `http://<public-ip>/`.

7. Read the API Function URL output:

```bash
terraform -chdir=infra/terraform/stack output api_lambda_function_url
```

## Game instance options

`game_instances` now supports:

- `health_sidecar_image` (optional): image for sidecar serving `/ping`
- `health_port` (optional, default `8080`)
- `dns_name` (optional): game DNS name
- `route53_zone_id` (optional): hosted zone ID used by API Route53 updates

When `health_sidecar_image` is set, Terraform adds:

- A second ECS container (`health-sidecar`) in the task definition
- Security group ingress for `health_port` for `allowed_ingress_cidrs`

## API stack options

Key API variables in `stack/variables.tf`:

- `api_lambda_zip_path` (default `../../../apps/api/dist/lambda.zip`)
- `api_lambda_memory_size` / `api_lambda_timeout_seconds`
- `api_function_url_auth_type` (`NONE` or `AWS_IAM`)
- `api_function_url_cors_allow_origins` / methods / headers
- `api_dynamodb_table_name` (optional override)
- `api_environment_variables` (additional Lambda env vars)

## Validate locally

```bash
terraform fmt -recursive infra/terraform
terraform -chdir=infra/terraform/stack init -backend=false
terraform -chdir=infra/terraform/stack validate
```
