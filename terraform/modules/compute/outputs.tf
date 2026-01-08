# Outputs for the compute module

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = var.enable_load_balancer ? aws_lb.main[0].dns_name : null
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = var.enable_load_balancer ? aws_lb.main[0].zone_id : null
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = var.enable_load_balancer ? aws_lb.main[0].arn : null
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = var.enable_load_balancer ? aws_lb_target_group.main[0].arn : null
}

output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.main.name
}

output "autoscaling_group_arn" {
  description = "ARN of the Auto Scaling Group"
  value       = aws_autoscaling_group.main.arn
}

output "launch_template_id" {
  description = "ID of the launch template"
  value       = aws_launch_template.main.id
}

output "launch_template_latest_version" {
  description = "Latest version of the launch template"
  value       = aws_launch_template.main.latest_version
}

output "iam_role_arn" {
  description = "ARN of the IAM role for EC2 instances"
  value       = aws_iam_role.ec2_role.arn
}

output "iam_instance_profile_name" {
  description = "Name of the IAM instance profile"
  value       = aws_iam_instance_profile.ec2_profile.name
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app_logs.name
}

output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = var.enable_ecs ? aws_ecs_cluster.main[0].id : null
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = var.enable_ecs ? aws_ecs_cluster.main[0].arn : null
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = var.enable_ecs ? aws_ecs_service.main[0].name : null
}

output "application_url" {
  description = "URL to access the application"
  value       = var.enable_load_balancer ? "http://${aws_lb.main[0].dns_name}" : null
}