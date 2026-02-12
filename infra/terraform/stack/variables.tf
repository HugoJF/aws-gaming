variable "project_name" {
  description = "Project name"
  type        = string
  default     = "aws-gaming"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "default"
}

variable "aws_region" {
  description = "AWS region for deploys"
  type        = string
  default     = "sa-east-1"
}

variable "platform_vpc_cidr" {
  description = "CIDR block for the shared platform VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "platform_public_subnet_cidrs" {
  description = "Public subnet CIDRs for the platform"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "platform_route53_zone_id" {
  description = "Optional shared Route53 hosted zone ID used by all game instances in this stack"
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

variable "api_lambda_zip_path" {
  description = "Path to the packaged API Lambda zip artifact"
  type        = string
  default     = "../../../apps/api/dist/lambda.zip"
}

variable "api_lambda_source_code_hash" {
  description = "Optional base64-encoded SHA256 hash for the API Lambda zip"
  type        = string
  default     = null
}

variable "api_lambda_runtime" {
  description = "Runtime used by the API Lambda function"
  type        = string
  default     = "nodejs20.x"
}

variable "api_lambda_handler" {
  description = "Handler used by the API Lambda function"
  type        = string
  default     = "index.handler"
}

variable "api_lambda_memory_size" {
  description = "Memory size (MB) for API Lambda"
  type        = number
  default     = 512
}

variable "api_lambda_timeout_seconds" {
  description = "Timeout (seconds) for API Lambda"
  type        = number
  default     = 30
}

variable "api_lambda_reserved_concurrent_executions" {
  description = "Reserved concurrency limit for API Lambda. Set null to disable."
  type        = number
  default     = null
}

variable "api_lambda_architectures" {
  description = "CPU architectures for API Lambda"
  type        = list(string)
  default     = ["x86_64"]
}

variable "api_dynamodb_table_name" {
  description = "Optional table name override for the API DynamoDB table"
  type        = string
  default     = null
}

variable "api_log_retention_days" {
  description = "CloudWatch log retention (days) for API Lambda"
  type        = number
  default     = 14
}

variable "api_function_url_auth_type" {
  description = "Lambda Function URL auth type for API (NONE or AWS_IAM)"
  type        = string
  default     = "NONE"

  validation {
    condition     = contains(["NONE", "AWS_IAM"], var.api_function_url_auth_type)
    error_message = "api_function_url_auth_type must be NONE or AWS_IAM."
  }
}

variable "api_function_url_cors_allow_origins" {
  description = "Allowed CORS origins for the API Function URL"
  type        = list(string)
  default     = ["*"]
}

variable "api_function_url_cors_allow_methods" {
  description = "Allowed CORS methods for the API Function URL"
  type        = list(string)
  default     = ["GET", "POST", "PATCH"]
}

variable "api_function_url_cors_allow_headers" {
  description = "Allowed CORS headers for the API Function URL"
  type        = list(string)
  default     = ["authorization", "content-type"]
}

variable "api_environment_variables" {
  description = "Additional environment variables for API Lambda"
  type        = map(string)
  default     = {}
}

variable "api_enable_attack_detection_alarms" {
  description = "Whether to create attack-detection CloudWatch alarms for the public API Lambda"
  type        = bool
  default     = true
}

variable "api_alarm_action_arns" {
  description = "Alarm action ARNs (for example SNS topics) for API attack-detection alarms"
  type        = list(string)
  default     = []
}

variable "api_ok_action_arns" {
  description = "OK action ARNs (for example SNS topics) for API attack-detection alarms"
  type        = list(string)
  default     = []
}

variable "api_alarm_invocations_threshold" {
  description = "Invocation count threshold (5-minute Sum) for suspicious traffic alarm"
  type        = number
  default     = 3000
}

variable "api_alarm_errors_threshold" {
  description = "Error count threshold (5-minute Sum) for suspicious traffic alarm"
  type        = number
  default     = 25
}

variable "api_alarm_throttles_threshold" {
  description = "Throttle count threshold (5-minute Sum) for suspicious traffic alarm"
  type        = number
  default     = 5
}

variable "api_alarm_concurrency_threshold" {
  description = "Concurrent executions threshold (5-minute Maximum) for suspicious traffic alarm"
  type        = number
  default     = 20
}

variable "shared_health_sidecar_image" {
  description = "Shared health sidecar image used by all game instances"
  type        = string
  default     = "public.ecr.aws/docker/library/busybox@sha256:68fb61caa577f233800d50bef8fe0ee1235ed56a641178783032935223630576"
}

variable "game_instances" {
  description = "Map of game instances to deploy"
  type = map(object({
    template_id                  = string
    container_image              = string
    container_command            = optional(list(string))
    host_port                    = optional(number, 80)
    game_type                    = optional(string, "minecraft")
    display_name                 = optional(string)
    game_label                   = optional(string)
    location                     = optional(string)
    max_players                  = optional(number, 20)
    query_port                   = optional(number)
    instance_type                = optional(string, "t3.micro")
    container_memory_reservation = optional(number, 256)
    ecs_optimized_ami_ssm_path   = optional(string, "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id")
    ssh_key_name                 = optional(string)
    spot_max_price               = optional(string)
    extra_ingress_cidrs          = optional(list(string), [])
    ssh_ingress_cidrs            = optional(list(string), [])
    dns_name                     = optional(string)
  }))
  default = {}

  validation {
    condition = alltrue([
      for cfg in values(var.game_instances) :
      try(cfg.game_type == null || contains(
        ["minecraft", "zomboid", "generic"],
      cfg.game_type), true)
    ])
    error_message = "game_instances[*].game_type must be one of: minecraft, zomboid, generic."
  }
}
