data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

locals {
  name_prefix         = "${var.project_name}-${var.environment}"
  function_name       = "${local.name_prefix}-api"
  resolved_table_name = coalesce(var.dynamodb_table_name, local.name_prefix)

  base_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "api"
  })

  route53_zone_ids = distinct(compact([
    for cfg in values(var.game_instance_configs) : try(cfg.route53_zone_id, null)
  ]))
  route53_zone_arns = [for zone_id in local.route53_zone_ids : "arn:aws:route53:::hostedzone/${zone_id}"]
  ecs_service_arns = (
    var.ecs_cluster_name == null ? [] : [
      for service_name in var.ecs_service_names :
      "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:service/${var.ecs_cluster_name}/${service_name}"
    ]
  )
  autoscaling_group_arns = [
    for asg_name in var.autoscaling_group_names :
    "arn:aws:autoscaling:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:autoScalingGroup:*:autoScalingGroupName/${asg_name}"
  ]

  lambda_environment = merge({
    DYNAMODB_TABLE_NAME = aws_dynamodb_table.api.name
    GAME_INSTANCES_JSON = jsonencode(var.game_instance_configs)
  }, var.environment_variables)
}

resource "aws_dynamodb_table" "api" {
  name         = local.resolved_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(local.base_tags, {
    Name = local.resolved_table_name
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(local.base_tags, {
    Name = local.function_name
  })
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    actions = [
      "sts:AssumeRole"
    ]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.base_tags
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.lambda.arn}:*"]
  }

  statement {
    sid    = "DynamoDbAccess"
    effect = "Allow"
    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem"
    ]
    resources = [
      aws_dynamodb_table.api.arn,
      "${aws_dynamodb_table.api.arn}/index/*"
    ]
  }

  statement {
    sid    = "EcsRead"
    effect = "Allow"
    actions = [
      "ecs:DescribeContainerInstances",
      "ecs:DescribeServices",
      "ecs:ListContainerInstances"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "EcsUpdateService"
    effect = "Allow"
    actions = [
      "ecs:UpdateService"
    ]
    resources = length(local.ecs_service_arns) > 0 ? local.ecs_service_arns : ["*"]
  }

  statement {
    sid    = "AutoScalingRead"
    effect = "Allow"
    actions = [
      "autoscaling:DescribeAutoScalingGroups"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "AutoScalingWrite"
    effect = "Allow"
    actions = [
      "autoscaling:SetDesiredCapacity",
      "autoscaling:UpdateAutoScalingGroup"
    ]
    resources = length(local.autoscaling_group_arns) > 0 ? local.autoscaling_group_arns : ["*"]
  }

  statement {
    sid    = "Ec2DescribeRead"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances"
    ]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = length(local.route53_zone_arns) > 0 ? [1] : []

    content {
      sid    = "Route53DnsUpdates"
      effect = "Allow"
      actions = [
        "route53:ChangeResourceRecordSets",
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets"
      ]
      resources = local.route53_zone_arns
    }
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_lambda_function" "api" {
  function_name                  = local.function_name
  role                           = aws_iam_role.lambda.arn
  runtime                        = var.lambda_runtime
  handler                        = var.lambda_handler
  filename                       = var.lambda_zip_path
  architectures                  = var.lambda_architectures
  memory_size                    = var.lambda_memory_size
  timeout                        = var.lambda_timeout_seconds
  reserved_concurrent_executions = var.lambda_reserved_concurrent_executions

  source_code_hash = coalesce(var.lambda_source_code_hash, filebase64sha256(var.lambda_zip_path))

  environment {
    variables = local.lambda_environment
  }

  tags = merge(local.base_tags, {
    Name = local.function_name
  })

  depends_on = [aws_cloudwatch_log_group.lambda]
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = var.function_url_auth_type

  cors {
    allow_credentials = false
    allow_headers     = var.function_url_cors_allow_headers
    allow_methods     = var.function_url_cors_allow_methods
    allow_origins     = var.function_url_cors_allow_origins
    max_age           = 3600
  }
}

resource "aws_lambda_permission" "public_function_url" {
  count = var.function_url_auth_type == "NONE" ? 1 : 0

  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "public_function_invoke" {
  count = var.function_url_auth_type == "NONE" ? 1 : 0

  statement_id  = "AllowPublicFunctionInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "*"
}

resource "aws_cloudwatch_metric_alarm" "lambda_invocations_spike" {
  count = var.enable_attack_detection_alarms ? 1 : 0

  alarm_name          = "${local.function_name}-invocations-spike"
  alarm_description   = "Potential attack signal: abnormal invocation spike on public API Lambda"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Invocations"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_invocations_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  alarm_actions = var.alarm_action_arns
  ok_actions    = var.ok_action_arns
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors_spike" {
  count = var.enable_attack_detection_alarms ? 1 : 0

  alarm_name          = "${local.function_name}-errors-spike"
  alarm_description   = "Potential attack signal: elevated Lambda errors on public API"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_errors_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  alarm_actions = var.alarm_action_arns
  ok_actions    = var.ok_action_arns
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles_spike" {
  count = var.enable_attack_detection_alarms ? 1 : 0

  alarm_name          = "${local.function_name}-throttles-spike"
  alarm_description   = "Potential attack signal: Lambda throttling spike on public API"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_throttles_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  alarm_actions = var.alarm_action_arns
  ok_actions    = var.ok_action_arns
}

resource "aws_cloudwatch_metric_alarm" "lambda_concurrency_spike" {
  count = var.enable_attack_detection_alarms ? 1 : 0

  alarm_name          = "${local.function_name}-concurrency-spike"
  alarm_description   = "Potential attack signal: concurrent execution spike on public API Lambda"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = var.alarm_concurrency_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  alarm_actions = var.alarm_action_arns
  ok_actions    = var.ok_action_arns
}
