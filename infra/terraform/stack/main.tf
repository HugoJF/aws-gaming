locals {
  api_game_instance_configs = {
    for instance_id, cfg in var.game_instances : instance_id => merge(
      {
        template_id = cfg.template_id
        host_port   = cfg.host_port
        health_port = cfg.health_port
      },
      try(cfg.dns_name, null) != null ? { dns_name = cfg.dns_name } : {},
      try(cfg.route53_zone_id, null) != null ? { route53_zone_id = cfg.route53_zone_id } : {}
    )
  }
}

module "platform" {
  source = "../modules/platform"

  project_name        = var.project_name
  environment         = var.environment
  vpc_cidr            = var.platform_vpc_cidr
  public_subnet_cidrs = var.platform_public_subnet_cidrs
  tags                = var.tags
}

module "game_service" {
  for_each = var.game_instances
  source   = "../modules/game-service"

  project_name                    = var.project_name
  environment                     = var.environment
  game_instance_id                = each.key
  template_id                     = each.value.template_id
  vpc_id                          = module.platform.vpc_id
  ecs_cluster_arn                 = module.platform.ecs_cluster_arn
  public_subnet_ids               = module.platform.public_subnet_ids
  container_image                 = each.value.container_image
  container_port                  = each.value.container_port
  host_port                       = each.value.host_port
  health_port                     = each.value.health_port
  instance_type                   = each.value.instance_type
  instance_count                  = each.value.instance_count
  task_count                      = each.value.task_count
  container_memory_reservation    = each.value.container_memory_reservation
  health_sidecar_image            = try(each.value.health_sidecar_image, null)
  ecs_optimized_ami_ssm_parameter = each.value.ecs_optimized_ami_ssm_path
  ssh_key_name                    = try(each.value.ssh_key_name, null)
  spot_max_price                  = try(each.value.spot_max_price, null)
  allowed_ingress_cidrs           = each.value.allowed_ingress_cidrs
  ssh_ingress_cidrs               = each.value.ssh_ingress_cidrs
  dns_name                        = try(each.value.dns_name, null)
  route53_zone_id                 = try(each.value.route53_zone_id, null)
  tags                            = var.tags
}

module "api" {
  source = "../modules/api"

  project_name                    = var.project_name
  environment                     = var.environment
  lambda_zip_path                 = var.api_lambda_zip_path
  lambda_source_code_hash         = var.api_lambda_source_code_hash
  lambda_runtime                  = var.api_lambda_runtime
  lambda_handler                  = var.api_lambda_handler
  lambda_memory_size              = var.api_lambda_memory_size
  lambda_timeout_seconds          = var.api_lambda_timeout_seconds
  lambda_architectures            = var.api_lambda_architectures
  dynamodb_table_name             = var.api_dynamodb_table_name
  log_retention_days              = var.api_log_retention_days
  function_url_auth_type          = var.api_function_url_auth_type
  function_url_cors_allow_origins = var.api_function_url_cors_allow_origins
  function_url_cors_allow_methods = var.api_function_url_cors_allow_methods
  function_url_cors_allow_headers = var.api_function_url_cors_allow_headers
  environment_variables           = var.api_environment_variables
  game_instance_configs           = local.api_game_instance_configs
  tags                            = var.tags
}
