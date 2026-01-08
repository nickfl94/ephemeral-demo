# Outputs for the monitoring module

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = var.create_sns_topic ? aws_sns_topic.alerts[0].arn : null
}

output "high_cpu_alarm_name" {
  description = "Name of the high CPU alarm"
  value       = aws_cloudwatch_metric_alarm.high_cpu.alarm_name
}

output "high_cpu_alarm_arn" {
  description = "ARN of the high CPU alarm"
  value       = aws_cloudwatch_metric_alarm.high_cpu.arn
}

output "high_memory_alarm_name" {
  description = "Name of the high memory alarm"
  value       = var.enable_custom_metrics ? aws_cloudwatch_metric_alarm.high_memory[0].alarm_name : null
}

output "high_memory_alarm_arn" {
  description = "ARN of the high memory alarm"
  value       = var.enable_custom_metrics ? aws_cloudwatch_metric_alarm.high_memory[0].arn : null
}

output "high_response_time_alarm_name" {
  description = "Name of the high response time alarm"
  value       = var.load_balancer_arn_suffix != null ? aws_cloudwatch_metric_alarm.high_response_time[0].alarm_name : null
}

output "high_response_time_alarm_arn" {
  description = "ARN of the high response time alarm"
  value       = var.load_balancer_arn_suffix != null ? aws_cloudwatch_metric_alarm.high_response_time[0].arn : null
}

output "high_error_rate_alarm_name" {
  description = "Name of the high error rate alarm"
  value       = var.load_balancer_arn_suffix != null ? aws_cloudwatch_metric_alarm.high_error_rate[0].alarm_name : null
}

output "high_error_rate_alarm_arn" {
  description = "ARN of the high error rate alarm"
  value       = var.load_balancer_arn_suffix != null ? aws_cloudwatch_metric_alarm.high_error_rate[0].arn : null
}

output "low_healthy_targets_alarm_name" {
  description = "Name of the low healthy targets alarm"
  value       = var.target_group_arn_suffix != null ? aws_cloudwatch_metric_alarm.low_healthy_targets[0].alarm_name : null
}

output "low_healthy_targets_alarm_arn" {
  description = "ARN of the low healthy targets alarm"
  value       = var.target_group_arn_suffix != null ? aws_cloudwatch_metric_alarm.low_healthy_targets[0].arn : null
}

output "composite_alarm_name" {
  description = "Name of the composite alarm for overall health"
  value       = aws_cloudwatch_composite_alarm.environment_health.alarm_name
}

output "composite_alarm_arn" {
  description = "ARN of the composite alarm for overall health"
  value       = aws_cloudwatch_composite_alarm.environment_health.arn
}

output "error_analysis_query_name" {
  description = "Name of the error analysis CloudWatch Insights query"
  value       = aws_cloudwatch_query_definition.error_analysis.name
}

output "performance_analysis_query_name" {
  description = "Name of the performance analysis CloudWatch Insights query"
  value       = aws_cloudwatch_query_definition.performance_analysis.name
}