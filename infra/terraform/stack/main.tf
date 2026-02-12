locals {
  shared_health_port    = 8080
  default_ingress_cidrs = ["0.0.0.0/0"]
  aws_region_labels = {
    "sa-east-1" = "South America (Sao Paulo)"
  }
  default_location_label = lookup(
    local.aws_region_labels,
    var.aws_region,
    var.aws_region,
  )
  game_labels = {
    minecraft = "Minecraft"
    zomboid   = "Project Zomboid"
    generic   = "Generic Container"
  }

  game_instance_inventory = {
    for instance_id, cfg in var.game_instances : instance_id => {
      template_id  = cfg.template_id
      game_type    = cfg.game_type
      display_name = coalesce(try(cfg.display_name, null), instance_id)
      game_label   = coalesce(try(cfg.game_label, null), local.game_labels[cfg.game_type])
      location     = coalesce(try(cfg.location, null), local.default_location_label)
      max_players  = cfg.max_players
      host_port    = cfg.host_port
      query_port   = try(cfg.query_port, null)
      dns_name     = try(cfg.dns_name, null)
    }
  }

  api_game_instance_configs = {
    for instance_id, cfg in var.game_instances : instance_id => merge(
      {
        template_id = cfg.template_id
        host_port   = cfg.host_port
        health_port = local.shared_health_port
      },
      try(cfg.dns_name, null) != null ? { dns_name = cfg.dns_name } : {},
      var.platform_route53_zone_id != null ? { route53_zone_id = var.platform_route53_zone_id } : {}
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
  container_command               = try(each.value.container_command, null)
  container_environment           = each.value.container_environment
  container_health_check          = try(each.value.container_health_check, null)
  container_port                  = each.value.host_port
  host_port                       = each.value.host_port
  health_port                     = local.shared_health_port
  instance_type                   = each.value.instance_type
  instance_count                  = 1
  task_count                      = 1
  container_memory_reservation    = each.value.container_memory_reservation
  log_retention_days              = var.game_log_retention_days
  health_sidecar_image            = var.shared_health_sidecar_image
  ecs_optimized_ami_ssm_parameter = each.value.ecs_optimized_ami_ssm_path
  ssh_key_name                    = try(each.value.ssh_key_name, null)
  spot_max_price                  = try(each.value.spot_max_price, null)
  allowed_ingress_cidrs           = distinct(concat(local.default_ingress_cidrs, each.value.extra_ingress_cidrs))
  ssh_ingress_cidrs               = each.value.ssh_ingress_cidrs
  dns_name                        = try(each.value.dns_name, null)
  route53_zone_id                 = var.platform_route53_zone_id
  tags                            = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = module.platform.ecs_cluster_name

  capacity_providers = [
    for key in sort(keys(module.game_service)) :
    module.game_service[key].capacity_provider_name
  ]
}

module "api" {
  source = "../modules/api"

  project_name                          = var.project_name
  environment                           = var.environment
  lambda_zip_path                       = var.api_lambda_zip_path
  lambda_source_code_hash               = var.api_lambda_source_code_hash
  lambda_runtime                        = var.api_lambda_runtime
  lambda_handler                        = var.api_lambda_handler
  lambda_memory_size                    = var.api_lambda_memory_size
  lambda_timeout_seconds                = var.api_lambda_timeout_seconds
  lambda_reserved_concurrent_executions = var.api_lambda_reserved_concurrent_executions
  lambda_architectures                  = var.api_lambda_architectures
  dynamodb_table_name                   = var.api_dynamodb_table_name
  log_retention_days                    = var.api_log_retention_days
  function_url_auth_type                = var.api_function_url_auth_type
  function_url_cors_allow_origins       = var.api_function_url_cors_allow_origins
  function_url_cors_allow_methods       = var.api_function_url_cors_allow_methods
  function_url_cors_allow_headers       = var.api_function_url_cors_allow_headers
  environment_variables                 = var.api_environment_variables
  enable_attack_detection_alarms        = var.api_enable_attack_detection_alarms
  alarm_action_arns                     = var.api_alarm_action_arns
  ok_action_arns                        = var.api_ok_action_arns
  alarm_invocations_threshold           = var.api_alarm_invocations_threshold
  alarm_errors_threshold                = var.api_alarm_errors_threshold
  alarm_throttles_threshold             = var.api_alarm_throttles_threshold
  alarm_concurrency_threshold           = var.api_alarm_concurrency_threshold
  ecs_cluster_name                      = module.platform.ecs_cluster_name
  ecs_service_names                     = [for key in sort(keys(module.game_service)) : module.game_service[key].ecs_service_name]
  autoscaling_group_names               = [for key in sort(keys(module.game_service)) : module.game_service[key].auto_scaling_group_name]
  game_instance_configs                 = local.api_game_instance_configs
  tags                                  = var.tags
}

resource "aws_dynamodb_table_item" "game_instance" {
  for_each = local.game_instance_inventory

  table_name = module.api.dynamodb_table_name
  hash_key   = "pk"
  range_key  = "sk"

  item = jsonencode(merge(
    {
      pk                   = { S = "INSTANCE#${each.key}" }
      sk                   = { S = "INSTANCE" }
      entityType           = { S = "GameInstance" }
      id                   = { S = each.key }
      templateId           = { S = each.value.template_id }
      displayName          = { S = each.value.display_name }
      gameType             = { S = each.value.game_type }
      gameLabel            = { S = each.value.game_label }
      location             = { S = each.value.location }
      maxPlayers           = { N = tostring(each.value.max_players) }
      hostPort             = { N = tostring(each.value.host_port) }
      healthPort           = { N = tostring(local.shared_health_port) }
      ecsClusterArn        = { S = module.platform.ecs_cluster_arn }
      ecsServiceName       = { S = module.game_service[each.key].ecs_service_name }
      autoScalingGroupName = { S = module.game_service[each.key].auto_scaling_group_name }
      instanceCount        = { N = "1" }
      taskCount            = { N = "1" }
    },
    each.value.query_port == null ? {} : {
      queryPort = { N = tostring(each.value.query_port) }
    },
    each.value.dns_name == null ? {} : {
      dnsName = { S = each.value.dns_name }
    },
    var.platform_route53_zone_id == null ? {} : {
      route53ZoneId = { S = var.platform_route53_zone_id }
    }
  ))

  depends_on = [module.game_service]
}
