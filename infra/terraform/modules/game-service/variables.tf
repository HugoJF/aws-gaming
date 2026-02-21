variable "project_name" {
  description = "Project identifier"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "game_instance_id" {
  description = "Unique ID for a game instance"
  type        = string
}

variable "template_id" {
  description = "Template identifier for the game"
  type        = string
}

variable "vpc_id" {
  description = "VPC id where resources are deployed"
  type        = string
}

variable "ecs_cluster_arn" {
  description = "Target ECS cluster ARN"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet ids for ASG placement"
  type        = list(string)
}

variable "container_image" {
  description = "Container image for the game service"
  type        = string
}

variable "container_command" {
  description = "Optional container command override for the game service"
  type        = list(string)
  default     = null
}

variable "container_environment" {
  description = "Optional environment variables for the game container"
  type        = map(string)
  default     = {}
}

variable "container_health_check" {
  description = "Optional ECS health check config for the primary game container"
  type = object({
    command      = list(string)
    interval     = optional(number, 30)
    timeout      = optional(number, 5)
    retries      = optional(number, 3)
    start_period = optional(number, 60)
  })
  default = null
}

variable "container_port" {
  description = "Container port exposed by the service"
  type        = number
  default     = 80
}

variable "host_port" {
  description = "Host port mapped to the container"
  type        = number
  default     = 80
}

variable "health_port" {
  description = "Host port mapped to the health sidecar container"
  type        = number
  default     = 8080
}

variable "instance_type" {
  description = "EC2 instance type for the ECS capacity"
  type        = string
  default     = "t3.micro"
}

variable "instance_count" {
  description = "Desired/min/max instance count for the ASG"
  type        = number
  default     = 1
}

variable "task_count" {
  description = "Desired ECS service task count"
  type        = number
  default     = 1
}

variable "container_memory_reservation" {
  description = "Memory reservation in MiB for the container"
  type        = number
  default     = 256
}

variable "ecs_optimized_ami_ssm_parameter" {
  description = "SSM parameter containing ECS optimized AMI id"
  type        = string
  default     = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
}

variable "ssh_key_name" {
  description = "Optional EC2 key pair name"
  type        = string
  default     = null
}

variable "spot_max_price" {
  description = "Optional spot max price. If null, instances are on-demand"
  type        = string
  default     = null
}

variable "allowed_ingress_cidrs" {
  description = "CIDRs allowed to access the service port"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_ingress_cidrs" {
  description = "CIDRs allowed to access SSH (port 22)"
  type        = list(string)
  default     = []
}

variable "dns_name" {
  description = "Optional DNS record name (not implemented yet)"
  type        = string
  default     = null
}

variable "route53_zone_id" {
  description = "Optional Route53 hosted zone ID used by the API for DNS updates"
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention (days) for game container logs"
  type        = number
  default     = 14
}

variable "efs_container_path" {
  description = "Container path where the EFS volume is mounted"
  type        = string
  default     = "/data"
}

variable "efs_owner_uid" {
  description = "UID to set on the EFS mount directory"
  type        = number
  default     = 1000
}

variable "efs_owner_gid" {
  description = "GID to set on the EFS mount directory"
  type        = number
  default     = 1000
}

variable "health_sidecar_image" {
  description = "Health sidecar container image."
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
