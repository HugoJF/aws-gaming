# Terraform

## Layout

- `modules/platform`: shared resources (VPC, public subnets, ECS cluster)
- `modules/game-service`: per-game ECS-on-EC2 resources (security group, ASG, task, service, optional health sidecar)
- `modules/api`: API resources (Lambda + Function URL + DynamoDB + IAM)
- `stack`: single environment entrypoint (default workspace)

## Game instance definition model

Game instances are defined as explicit module references (not via input variables):

- File: `infra/terraform/stack/main.tf`
- Pattern: one module per game server (e.g. `module "game_service_hello_web"`)

To add a server, copy an existing game-service module block and change ids/ports/images.

## First deploy (hello world)

1. Create backend infrastructure (once):

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

2. Ensure backend config exists:

```bash
cat infra/terraform/stack/backend.hcl
```

3. Build the API Lambda artifact:

```bash
make api-lambda
```

This creates `apps/api/dist/lambda.zip` (the default `api_lambda_zip_path` used by the stack).

4. Initialize and deploy:

```bash
make tf-init
make tf-plan
make tf-apply
```

5. Get the instance public IP (for `hello-web`):

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

6. Read the API Function URL output:

```bash
make tf-output-api-url
```

You can override tfvars file when needed:

```bash
make tf-plan TF_VARS_FILE=staging.tfvars
```

## Game instance options

Each `module "game_service_<id>"` block supports:

- `health_sidecar_image` (optional): image for sidecar serving `/ping`
- `health_port` (optional, default `8080`)
- `dns_name` (optional): game DNS name
- `route53_zone_id` (optional): hosted zone ID used by API Route53 updates

When `health_sidecar_image` is set, Terraform adds:

- A second ECS container (`health-sidecar`) in the task definition
- Security group ingress for `health_port` for `allowed_ingress_cidrs`

Also add the server to API module wiring in `infra/terraform/stack/main.tf`:

- `ecs_service_names`
- `autoscaling_group_names`
- `game_instance_configs`

## API stack options

Key API variables in `stack/variables.tf`:

- `api_lambda_zip_path` (default `../../../apps/api/dist/lambda.zip`)
- `api_lambda_memory_size` / `api_lambda_timeout_seconds`
- `api_lambda_reserved_concurrent_executions` (default `20`, cost/abuse guardrail)
- `api_function_url_auth_type` (`NONE` or `AWS_IAM`)
- `api_function_url_cors_allow_origins` / methods / headers
- `api_dynamodb_table_name` (optional override)
- `api_environment_variables` (additional Lambda env vars)
- `api_enable_attack_detection_alarms` + alarm thresholds/action ARNs

## Security and abuse controls

- API is designed to run publicly when `api_function_url_auth_type = "NONE"`.
- API Lambda IAM write actions are scoped to stack-managed ECS services and ASGs.
- Attack-signal alarms can be enabled for Lambda invocation/error/throttle/concurrency spikes.
- Reserved concurrency can cap Lambda scale during abuse bursts.

## Validate locally

```bash
make tf-fmt
make tf-validate
```
