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
  default     = ["GET", "POST", "OPTIONS"]
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

variable "game_instances" {
  description = "Map of game instances to deploy"
  type = map(object({
    template_id                  = string
    container_image              = string
    container_port               = optional(number, 80)
    host_port                    = optional(number, 80)
    health_port                  = optional(number, 8080)
    instance_type                = optional(string, "t3.micro")
    instance_count               = optional(number, 1)
    task_count                   = optional(number, 1)
    container_memory_reservation = optional(number, 256)
    health_sidecar_image         = optional(string)
    ecs_optimized_ami_ssm_path   = optional(string, "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id")
    ssh_key_name                 = optional(string)
    spot_max_price               = optional(string)
    allowed_ingress_cidrs        = optional(list(string), ["0.0.0.0/0"])
    ssh_ingress_cidrs            = optional(list(string), [])
    dns_name                     = optional(string)
    route53_zone_id              = optional(string)
  }))
  default = {}
}
