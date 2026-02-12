output "platform_name_prefix" {
  description = "Prefix used for platform naming"
  value       = module.platform.name_prefix
}

output "platform_vpc_id" {
  description = "Platform VPC id"
  value       = module.platform.vpc_id
}

output "platform_public_subnet_ids" {
  description = "Platform public subnet ids"
  value       = module.platform.public_subnet_ids
}

output "platform_ecs_cluster_name" {
  description = "Platform ECS cluster name"
  value       = module.platform.ecs_cluster_name
}

output "game_service_names" {
  description = "Computed ECS service names by game instance"
  value       = { for key, module_ref in module.game_service : key => module_ref.ecs_service_name }
}

output "game_asg_names" {
  description = "ASG names by game instance"
  value       = { for key, module_ref in module.game_service : key => module_ref.auto_scaling_group_name }
}

output "game_capacity_provider_names" {
  description = "ECS capacity provider names by game instance"
  value       = { for key, module_ref in module.game_service : key => module_ref.capacity_provider_name }
}

output "game_dns_names" {
  description = "DNS names by game instance"
  value       = { for key, module_ref in module.game_service : key => module_ref.dns_name }
}

output "game_health_ports" {
  description = "Health sidecar host ports by game instance"
  value       = { for key, module_ref in module.game_service : key => module_ref.health_port }
}

output "api_lambda_function_name" {
  description = "API Lambda function name"
  value       = module.api.lambda_function_name
}

output "api_lambda_function_url" {
  description = "API Lambda Function URL"
  value       = module.api.lambda_function_url
}

output "api_dynamodb_table_name" {
  description = "DynamoDB table used by API"
  value       = module.api.dynamodb_table_name
}
