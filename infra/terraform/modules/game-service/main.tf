data "aws_ssm_parameter" "ecs_ami" {
  name = var.ecs_optimized_ami_ssm_parameter
}

data "aws_region" "current" {}

data "aws_subnet" "efs" {
  id = var.public_subnet_ids[0]
}

locals {
  name_prefix            = "${var.project_name}-${var.environment}"
  ecs_service_name       = "${local.name_prefix}-${var.game_instance_id}"
  asg_name               = "${local.name_prefix}-${var.game_instance_id}-asg"
  capacity_provider_name = "cp-${local.name_prefix}-${var.game_instance_id}"
  cluster_name           = element(reverse(split("/", var.ecs_cluster_arn)), 0)
  health_sidecar_enabled = try(trimspace(var.health_sidecar_image) != "", false)

  base_tags = merge(var.tags, {
    Project      = var.project_name
    Environment  = var.environment
    ManagedBy    = "terraform"
    Module       = "game-service"
    GameTemplate = var.template_id
    GameInstance = var.game_instance_id
  })

  service_name_tag = "${local.name_prefix}-${var.game_instance_id}-instance"
  container_definitions = concat(
    [
      merge(
        {
          name              = var.game_instance_id
          image             = var.container_image
          essential         = true
          memoryReservation = var.container_memory_reservation
          portMappings = [
            {
              containerPort = var.container_port
              hostPort      = var.host_port
              protocol      = "tcp"
            }
          ]
        },
        var.container_command == null ? {} : {
          command = var.container_command
        },
        length(var.container_environment) == 0 ? {} : {
          environment = [
            for key in sort(keys(var.container_environment)) : {
              name  = key
              value = var.container_environment[key]
            }
          ]
        },
        var.container_health_check == null ? {} : {
          healthCheck = {
            command     = var.container_health_check.command
            interval    = var.container_health_check.interval
            timeout     = var.container_health_check.timeout
            retries     = var.container_health_check.retries
            startPeriod = var.container_health_check.start_period
          }
        },
        {
          logConfiguration = {
            logDriver = "awslogs"
            options = {
              "awslogs-group"         = aws_cloudwatch_log_group.containers.name
              "awslogs-region"        = data.aws_region.current.name
              "awslogs-stream-prefix" = var.game_instance_id
            }
          }
        },
        {
          mountPoints = [{
            containerPath = var.efs_container_path
            sourceVolume  = var.game_instance_id
            readOnly      = false
          }]
        }
      )
    ],
    local.health_sidecar_enabled ? [
      {
        name              = "health-sidecar"
        image             = var.health_sidecar_image
        essential         = false
        memoryReservation = 32
        command = [
          "sh",
          "-c",
          "mkdir -p /www && echo ok >/www/ping && exec httpd -f -p 8080 -h /www"
        ]
        healthCheck = {
          command     = ["CMD-SHELL", "wget -q -O- http://127.0.0.1:8080/ping >/dev/null || exit 1"]
          interval    = 30
          timeout     = 5
          retries     = 3
          startPeriod = 10
        }
        portMappings = [
          {
            containerPort = 8080
            hostPort      = var.health_port
            protocol      = "tcp"
          }
        ]
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            "awslogs-group"         = aws_cloudwatch_log_group.containers.name
            "awslogs-region"        = data.aws_region.current.name
            "awslogs-stream-prefix" = "health-sidecar"
          }
        }
      }
    ] : []
  )
}

resource "aws_cloudwatch_log_group" "containers" {
  name              = "/ecs/${local.name_prefix}-${var.game_instance_id}"
  retention_in_days = var.log_retention_days

  tags = local.base_tags
}

resource "aws_efs_file_system" "this" {
  availability_zone_name = data.aws_subnet.efs.availability_zone
  performance_mode       = "generalPurpose"

  lifecycle_policy {
    transition_to_ia = "AFTER_7_DAYS"
  }

  tags = merge(local.base_tags, {
    Name = "${local.name_prefix}-${var.game_instance_id}-efs"
  })
}

resource "aws_efs_backup_policy" "this" {
  file_system_id = aws_efs_file_system.this.id

  backup_policy {
    status = "ENABLED"
  }
}

resource "aws_security_group" "efs" {
  name        = "${local.name_prefix}-${var.game_instance_id}-efs"
  description = "Security group for ${var.game_instance_id} EFS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.instance.id]
  }

  tags = merge(local.base_tags, {
    Name = "${local.name_prefix}-${var.game_instance_id}-efs"
  })
}

resource "aws_efs_mount_target" "this" {
  file_system_id  = aws_efs_file_system.this.id
  subnet_id       = var.public_subnet_ids[0]
  security_groups = [aws_security_group.efs.id]
}

resource "aws_security_group" "instance" {
  name        = "${local.name_prefix}-${var.game_instance_id}-ec2"
  description = "Security group for ${var.game_instance_id} EC2 capacity"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.base_tags, {
    Name = "${local.name_prefix}-${var.game_instance_id}-ec2"
  })
}

resource "aws_vpc_security_group_ingress_rule" "service" {
  for_each = toset(var.allowed_ingress_cidrs)

  security_group_id = aws_security_group.instance.id
  cidr_ipv4         = each.value
  from_port         = var.host_port
  to_port           = var.host_port
  ip_protocol       = "tcp"
  description       = "Allow service traffic"
}

resource "aws_vpc_security_group_ingress_rule" "health" {
  for_each = local.health_sidecar_enabled ? {
    for cidr in var.allowed_ingress_cidrs : cidr => cidr
  } : {}

  security_group_id = aws_security_group.instance.id
  cidr_ipv4         = each.value
  from_port         = var.health_port
  to_port           = var.health_port
  ip_protocol       = "tcp"
  description       = "Allow health sidecar traffic"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = toset(var.ssh_ingress_cidrs)

  security_group_id = aws_security_group.instance.id
  cidr_ipv4         = each.value
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "Allow SSH access"
}

resource "aws_iam_role" "instance" {
  name = "${local.name_prefix}-${var.game_instance_id}-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = local.base_tags
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "instance" {
  name = "${local.name_prefix}-${var.game_instance_id}-instance-profile"
  role = aws_iam_role.instance.name

  tags = local.base_tags
}

resource "aws_launch_template" "this" {
  name_prefix   = "${local.name_prefix}-${var.game_instance_id}-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = var.instance_type
  key_name      = var.ssh_key_name

  user_data = base64encode(join("\n", [
    "#!/bin/bash -xe",
    "echo ECS_CLUSTER=${local.cluster_name} >> /etc/ecs/ecs.config",
    "echo ECS_ENABLE_TASK_IAM_ROLE=true >> /etc/ecs/ecs.config",
    "echo ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true >> /etc/ecs/ecs.config",
    "echo ECS_INSTANCE_ATTRIBUTES='{\"GameInstance\":\"${var.game_instance_id}\"}' >> /etc/ecs/ecs.config",
    "yum install -y amazon-efs-utils",
    "mkdir -p /opt/${var.game_instance_id}",
    "mount -t efs ${aws_efs_file_system.this.id}:/ /opt/${var.game_instance_id}",
    "chown ${var.efs_owner_uid}:${var.efs_owner_gid} /opt/${var.game_instance_id}",
  ]))

  iam_instance_profile {
    arn = aws_iam_instance_profile.instance.arn
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.instance.id]
  }

  dynamic "instance_market_options" {
    for_each = var.spot_max_price == null ? [] : [var.spot_max_price]

    content {
      market_type = "spot"

      spot_options {
        max_price = instance_market_options.value
      }
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.base_tags, {
      Name = local.service_name_tag
    })
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(local.base_tags, {
      Name = local.service_name_tag
    })
  }

  tags = local.base_tags
}

resource "aws_autoscaling_group" "this" {
  name                = local.asg_name
  min_size            = var.instance_count
  max_size            = var.instance_count
  desired_capacity    = var.instance_count
  # Pin to single AZ matching the One Zone EFS mount target.
  vpc_zone_identifier = [var.public_subnet_ids[0]]
  health_check_type   = "EC2"

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = local.service_name_tag
    propagate_at_launch = true
  }

  # Required for instances to register under the ECS capacity provider.
  tag {
    key                 = "AmazonECSManaged"
    value               = ""
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.base_tags

    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

resource "aws_ecs_capacity_provider" "this" {
  name = local.capacity_provider_name

  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.this.arn
  }

  tags = local.base_tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${local.name_prefix}-${var.game_instance_id}"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]

  container_definitions = jsonencode(local.container_definitions)

  volume {
    name      = var.game_instance_id
    host_path = "/opt/${var.game_instance_id}"
  }

  tags = local.base_tags
}

resource "aws_ecs_service" "this" {
  name                               = local.ecs_service_name
  cluster                            = var.ecs_cluster_arn
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = var.task_count
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  tags = local.base_tags

  # Hard-pin each service to its own EC2 ASG via dedicated capacity provider.
  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.this.name
    weight            = 1
  }

  depends_on = [aws_autoscaling_group.this, aws_ecs_capacity_provider.this]
}
