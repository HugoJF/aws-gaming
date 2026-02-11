variable "project_name" {
  description = "Project identifier"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the packaged Lambda zip artifact"
  type        = string
}

variable "lambda_source_code_hash" {
  description = "Optional base64-encoded SHA256 hash of the Lambda zip"
  type        = string
  default     = null
}

variable "lambda_runtime" {
  description = "Lambda runtime identifier"
  type        = string
  default     = "nodejs20.x"
}

variable "lambda_handler" {
  description = "Lambda handler name"
  type        = string
  default     = "index.handler"
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout_seconds" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_architectures" {
  description = "Lambda CPU architectures"
  type        = list(string)
  default     = ["x86_64"]
}

variable "dynamodb_table_name" {
  description = "Optional DynamoDB table name override. Defaults to <project>-<environment>."
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days for the API Lambda"
  type        = number
  default     = 14
}

variable "function_url_auth_type" {
  description = "Lambda Function URL auth type (NONE or AWS_IAM)"
  type        = string
  default     = "NONE"

  validation {
    condition     = contains(["NONE", "AWS_IAM"], var.function_url_auth_type)
    error_message = "function_url_auth_type must be NONE or AWS_IAM."
  }
}

variable "function_url_cors_allow_origins" {
  description = "Allowed CORS origins for the Lambda Function URL"
  type        = list(string)
  default     = ["*"]
}

variable "function_url_cors_allow_methods" {
  description = "Allowed CORS methods for the Lambda Function URL"
  type        = list(string)
  default     = ["GET", "POST", "OPTIONS"]
}

variable "function_url_cors_allow_headers" {
  description = "Allowed CORS headers for the Lambda Function URL"
  type        = list(string)
  default     = ["authorization", "content-type"]
}

variable "environment_variables" {
  description = "Additional environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "game_instance_configs" {
  description = "Per-instance config passed to the API as JSON"
  type = map(object({
    template_id     = string
    host_port       = number
    health_port     = number
    dns_name        = optional(string)
    route53_zone_id = optional(string)
  }))
  default = {}
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
