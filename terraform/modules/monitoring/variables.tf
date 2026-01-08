# Variables for the monitoring module

variable "environment_name" {
  description = "Name of the environment"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "log_group_name" {
  description = "Name of the CloudWatch log group"
  type        = string
}

variable "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  type        = string
}

variable "load_balancer_arn_suffix" {
  description = "ARN suffix of the load balancer"
  type        = string
  default     = null
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the target group"
  type        = string
  default     = null
}

variable "cpu_threshold" {
  description = "CPU utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "memory_threshold" {
  description = "Memory utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "response_time_threshold" {
  description = "Response time threshold in seconds for alarms"
  type        = number
  default     = 2
}

variable "error_rate_threshold" {
  description = "Error rate threshold for alarms"
  type        = number
  default     = 10
}

variable "min_healthy_targets" {
  description = "Minimum number of healthy targets"
  type        = number
  default     = 1
}

variable "enable_custom_metrics" {
  description = "Whether to enable custom CloudWatch metrics"
  type        = bool
  default     = true
}

variable "create_sns_topic" {
  description = "Whether to create an SNS topic for notifications"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = null
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarm triggers"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}