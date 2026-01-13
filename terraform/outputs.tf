# Outputs for main Terraform configuration

output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.networking.public_subnet_ids
}

output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = module.storage.assets_bucket_name
}

output "data_bucket_name" {
  description = "Name of the data S3 bucket"
  value       = module.storage.data_bucket_name
}

# Compute outputs
output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.compute.load_balancer_dns_name
}

output "application_url" {
  description = "URL to access the application"
  value       = module.compute.application_url
}

output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = module.compute.autoscaling_group_name
}