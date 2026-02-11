data "aws_ssm_parameter" "ecs_ami" {
  name = var.ecs_optimized_ami_ssm_parameter
}

locals {
  name_prefix            = "${var.project_name}-${var.environment}"
  ecs_service_name       = "${local.name_prefix}-${var.game_instance_id}"
  asg_name               = "${local.name_prefix}-${var.game_instance_id}-asg"
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
      }
    ],
    local.health_sidecar_enabled ? [
      {
        name              = "health-sidecar"
        image             = var.health_sidecar_image
        essential         = false
        memoryReservation = 32
        portMappings = [
          {
            containerPort = 8080
            hostPort      = var.health_port
            protocol      = "tcp"
          }
        ]
      }
    ] : []
  )
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
    "echo ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true >> /etc/ecs/ecs.config"
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
  vpc_zone_identifier = var.public_subnet_ids
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

  dynamic "tag" {
    for_each = local.base_tags

    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${local.name_prefix}-${var.game_instance_id}"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]

  container_definitions = jsonencode(local.container_definitions)

  tags = local.base_tags
}

resource "aws_ecs_service" "this" {
  name                               = local.ecs_service_name
  cluster                            = var.ecs_cluster_arn
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = var.task_count
  launch_type                        = "EC2"
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  tags = local.base_tags

  depends_on = [aws_autoscaling_group.this]
}
