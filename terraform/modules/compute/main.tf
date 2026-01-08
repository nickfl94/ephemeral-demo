# Compute module for ephemeral environments
# Creates EC2 instances, ECS clusters, and load balancers for application hosting

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM role for EC2 instances
resource "aws_iam_role" "ec2_role" {
  name_prefix = "${var.environment_name}-ec2-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.environment_name}-ec2-role"
    Type = "iam-role"
  })
}

# IAM policy for EC2 instances
resource "aws_iam_role_policy" "ec2_policy" {
  name_prefix = "${var.environment_name}-ec2-policy-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${var.s3_bucket_arn}/*"
      }
    ]
  })
}

# IAM instance profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name_prefix = "${var.environment_name}-ec2-profile-"
  role        = aws_iam_role.ec2_role.name

  tags = merge(var.tags, {
    Name = "${var.environment_name}-ec2-profile"
    Type = "iam-instance-profile"
  })
}

# Application Load Balancer
resource "aws_lb" "main" {
  count = var.enable_load_balancer ? 1 : 0

  name               = "${var.environment_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.web_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = merge(var.tags, {
    Name = "${var.environment_name}-alb"
    Type = "load-balancer"
  })
}

# Target group for load balancer
resource "aws_lb_target_group" "main" {
  count = var.enable_load_balancer ? 1 : 0

  name     = "${var.environment_name}-tg"
  port     = var.application_port
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-tg"
    Type = "target-group"
  })
}

# Load balancer listener
resource "aws_lb_listener" "main" {
  count = var.enable_load_balancer ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main[0].arn
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-listener"
    Type = "load-balancer-listener"
  })
}

# Launch template for EC2 instances
resource "aws_launch_template" "main" {
  name_prefix   = "${var.environment_name}-lt-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  vpc_security_group_ids = [var.web_security_group_id]

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    application_port = var.application_port
    s3_bucket_name   = var.s3_bucket_name
    environment_name = var.environment_name
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.environment_name}-instance"
      Type = "ec2-instance"
    })
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-launch-template"
    Type = "launch-template"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "main" {
  name                = "${var.environment_name}-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = var.enable_load_balancer ? [aws_lb_target_group.main[0].arn] : []
  health_check_type   = var.enable_load_balancer ? "ELB" : "EC2"
  health_check_grace_period = 300

  min_size         = var.min_instances
  max_size         = var.max_instances
  desired_capacity = var.desired_instances

  launch_template {
    id      = aws_launch_template.main.id
    version = "$Latest"
  }

  # Instance refresh configuration
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.environment_name}-asg"
    propagate_at_launch = false
  }

  dynamic "tag" {
    for_each = var.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/ec2/${var.environment_name}"
  retention_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.environment_name}-log-group"
    Type = "cloudwatch-log-group"
  })
}

# ECS Cluster (optional, for containerized applications)
resource "aws_ecs_cluster" "main" {
  count = var.enable_ecs ? 1 : 0

  name = "${var.environment_name}-ecs"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-ecs-cluster"
    Type = "ecs-cluster"
  })
}

# ECS Service (if ECS is enabled)
resource "aws_ecs_service" "main" {
  count = var.enable_ecs ? 1 : 0

  name            = "${var.environment_name}-service"
  cluster         = aws_ecs_cluster.main[0].id
  task_definition = var.ecs_task_definition_arn
  desired_count   = var.desired_instances

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.web_security_group_id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.enable_load_balancer ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.main[0].arn
      container_name   = var.container_name
      container_port   = var.application_port
    }
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-ecs-service"
    Type = "ecs-service"
  })

  depends_on = [aws_lb_listener.main]
}