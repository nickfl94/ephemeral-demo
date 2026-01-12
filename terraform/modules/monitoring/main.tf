# Monitoring module for ephemeral environments
# Creates CloudWatch dashboards, alarms, and monitoring resources

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.load_balancer_arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", var.autoscaling_group_name],
            ["AWS/AutoScaling", "GroupDesiredCapacity", "AutoScalingGroupName", var.autoscaling_group_name],
            [".", "GroupInServiceInstances", ".", "."],
            [".", "GroupTotalInstances", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Auto Scaling Group Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["EphemeralDemo/${var.environment_name}", "cpu_usage_active"],
            [".", "mem_used_percent"],
            [".", "disk_used_percent"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "System Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 18
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '${var.log_group_name}' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = var.aws_region
          title   = "Recent Application Logs"
        }
      }
    ]
  })
}

# CloudWatch Alarm for high CPU utilization
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.environment_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_threshold
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    AutoScalingGroupName = var.autoscaling_group_name
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-high-cpu-alarm"
    Type = "cloudwatch-alarm"
  })
}

# CloudWatch Alarm for high memory utilization
resource "aws_cloudwatch_metric_alarm" "high_memory" {
  count = var.enable_custom_metrics ? 1 : 0

  alarm_name          = "${var.environment_name}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "mem_used_percent"
  namespace           = "EphemeralDemo/${var.environment_name}"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_threshold
  alarm_description   = "This metric monitors memory utilization"
  alarm_actions       = var.alarm_actions

  tags = merge(var.tags, {
    Name = "${var.environment_name}-high-memory-alarm"
    Type = "cloudwatch-alarm"
  })
}

# CloudWatch Alarm for application response time
resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  count = var.enable_load_balancer ? 1 : 0

  alarm_name          = "${var.environment_name}-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = var.response_time_threshold
  alarm_description   = "This metric monitors application response time"
  alarm_actions       = var.alarm_actions

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-high-response-time-alarm"
    Type = "cloudwatch-alarm"
  })
}

# CloudWatch Alarm for application errors
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  count = var.enable_load_balancer ? 1 : 0

  alarm_name          = "${var.environment_name}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_rate_threshold
  alarm_description   = "This metric monitors application error rate"
  alarm_actions       = var.alarm_actions

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-high-error-rate-alarm"
    Type = "cloudwatch-alarm"
  })
}

# CloudWatch Alarm for low healthy targets
resource "aws_cloudwatch_metric_alarm" "low_healthy_targets" {
  count = var.enable_load_balancer ? 1 : 0

  alarm_name          = "${var.environment_name}-low-healthy-targets"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = var.min_healthy_targets
  alarm_description   = "This metric monitors healthy target count"
  alarm_actions       = var.alarm_actions

  dimensions = {
    TargetGroup  = var.target_group_arn_suffix
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-low-healthy-targets-alarm"
    Type = "cloudwatch-alarm"
  })
}

# SNS Topic for notifications (if not provided)
resource "aws_sns_topic" "alerts" {
  count = var.create_sns_topic ? 1 : 0

  name = "${var.environment_name}-alerts"

  tags = merge(var.tags, {
    Name = "${var.environment_name}-alerts-topic"
    Type = "sns-topic"
  })
}

# SNS Topic Subscription for email notifications
resource "aws_sns_topic_subscription" "email_alerts" {
  count = var.create_sns_topic && var.notification_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# CloudWatch Log Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.environment_name}-error-analysis"

  log_group_names = [var.log_group_name]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
| sort @timestamp desc
EOF
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.environment_name}-performance-analysis"

  log_group_names = [var.log_group_name]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /response_time/
| parse @message "response_time: * ms" as response_time
| stats avg(response_time), max(response_time), min(response_time) by bin(5m)
| sort @timestamp desc
EOF
}

# CloudWatch Composite Alarm for overall health
resource "aws_cloudwatch_composite_alarm" "environment_health" {
  alarm_name        = "${var.environment_name}-overall-health"
  alarm_description = "Composite alarm for overall environment health"

  alarm_rule = join(" OR ", compact([
    "ALARM(${aws_cloudwatch_metric_alarm.high_cpu.alarm_name})",
    var.enable_custom_metrics ? "ALARM(${aws_cloudwatch_metric_alarm.high_memory[0].alarm_name})" : null,
    var.enable_load_balancer ? "ALARM(${aws_cloudwatch_metric_alarm.high_response_time[0].alarm_name})" : null,
    var.enable_load_balancer ? "ALARM(${aws_cloudwatch_metric_alarm.high_error_rate[0].alarm_name})" : null,
    var.enable_load_balancer ? "ALARM(${aws_cloudwatch_metric_alarm.low_healthy_targets[0].alarm_name})" : null
  ]))

  alarm_actions = var.alarm_actions
}

# CloudWatch Metric Filter for application errors
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.environment_name}-error-count"
  log_group_name = var.log_group_name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "EphemeralDemo/${var.environment_name}"
    value     = "1"
  }
}

# CloudWatch Metric Filter for application warnings
resource "aws_cloudwatch_log_metric_filter" "warning_count" {
  name           = "${var.environment_name}-warning-count"
  log_group_name = var.log_group_name
  pattern        = "[timestamp, request_id, level=\"WARN\", ...]"

  metric_transformation {
    name      = "WarningCount"
    namespace = "EphemeralDemo/${var.environment_name}"
    value     = "1"
  }
}