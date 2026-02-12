output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.this.name
}

output "auto_scaling_group_name" {
  description = "Auto Scaling Group name"
  value       = aws_autoscaling_group.this.name
}

output "capacity_provider_name" {
  description = "ECS capacity provider name"
  value       = aws_ecs_capacity_provider.this.name
}

output "instance_security_group_id" {
  description = "Security group id attached to ECS instances"
  value       = aws_security_group.instance.id
}

output "dns_name" {
  description = "Configured DNS name"
  value       = var.dns_name
}

output "health_port" {
  description = "Configured health sidecar host port"
  value       = var.health_port
}

output "route53_zone_id" {
  description = "Configured Route53 hosted zone ID"
  value       = var.route53_zone_id
}
