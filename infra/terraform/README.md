# Terraform

## Layout

- `modules/platform`: shared resources (VPC, public subnets, ECS cluster)
- `modules/game-service`: per-game ECS-on-EC2 resources (security group, ASG, task, service, optional health sidecar)
- `modules/api`: API resources (Lambda + Function URL + DynamoDB + IAM)
- `stack`: single environment entrypoint (default workspace)

## Game instance definition model

Game instances are defined in variables (`game_instances`) and deployed via `for_each`:

- File: `infra/terraform/stack/main.tf`
- Variable: `var.game_instances`
- Example values: `infra/terraform/stack/hello-world.tfvars`

To add a server, add a new key to `game_instances` in the tfvars file.

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
  --billing-mode PAY_PER_REQUEST \
  --region sa-east-1
```

2. Build the API Lambda artifact:

```bash
make api-lambda
```

This creates `apps/api/dist/lambda.zip` (the default `api_lambda_zip_path` used by the stack).

3. Initialize and deploy:

```bash
make tf-init
make tf-plan
make tf-apply
```

4. Get the instance public IP (for `hello-web`):

```bash
INSTANCE_ID=$(aws ec2 describe-instances \
  --region sa-east-1 \
  --filters Name=tag:GameInstance,Values=hello-web Name=instance-state-name,Values=running \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

aws ec2 describe-instances \
  --region sa-east-1 \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

Then open `http://<public-ip>/`.

5. Read the API Function URL output:

```bash
make tf-output-api-url
```

You can override tfvars file when needed:

```bash
make tf-plan TF_VARS_FILE=staging.tfvars
```

`hello-world.tfvars` is committed in `infra/terraform/stack/` for this personal setup.

## Game instance options

Each `game_instances.<id>` entry supports:

- `game_type` (`minecraft`, `zomboid`, or `generic`)
- `display_name` (optional): UI display name (defaults to instance id)
- `game_label` (optional): UI label override (defaults from `game_type`)
- `location` (optional): UI location label (defaults to uppercased AWS region)
- `max_players` (optional): UI/server metadata value
- `host_port` (game port exposed externally)
- `query_port` (optional): override for GameDig query port
- `dns_name` (optional): game DNS name
- `extra_ingress_cidrs` (optional): additional CIDRs merged with default ingress CIDRs

Behavior enforced by stack wiring:

- `health_port` is fixed to `8080` across all servers.
- `shared_health_sidecar_image` is shared by all servers in the stack.
- `platform_route53_zone_id` is shared by all servers in the stack.
- `instance_count` and `task_count` are always `1`.
- `container_port` is always equal to `host_port`.
- Host and health ingress always include stack default CIDRs; `extra_ingress_cidrs` are additive.

When `health_sidecar_image` is set, Terraform adds:

- A second ECS container (`health-sidecar`) in the task definition
- Security group ingress for `health_port` for `allowed_ingress_cidrs`

API wiring for service/asg names and per-instance config is derived automatically from `game_instances`.

## API stack options

Key API variables in `stack/variables.tf`:

- `api_lambda_zip_path` (default `../../../apps/api/dist/lambda.zip`)
- `api_lambda_memory_size` / `api_lambda_timeout_seconds`
- `api_lambda_reserved_concurrent_executions` (default `null`; set to a number to cap API concurrency)
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
