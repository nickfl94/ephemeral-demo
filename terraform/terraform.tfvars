# Environment Configuration
environment_name = "demo-env-1768195876"
aws_region = "ap-southeast-2"

# Application Configuration  
branch_name = "main"
app_version = "1.0.0"
build_number = "1768195876"
git_commit = "41c5380d5adf635b148783c6185261f0958f4466"

# Infrastructure Configuration
instance_type = "t3.micro"
application_port = 3000
health_check_path = "/health"
min_instances = 1
max_instances = 3
desired_instances = 1

# Feature flags
enable_load_balancer = true
enable_ecs = false
enable_nat_gateway = true

# Network Configuration
vpc_cidr = "10.0.0.0/16"
public_subnet_count = 2
private_subnet_count = 2

# S3 Configuration
enable_s3_versioning = false
enable_s3_public_read = false
enable_s3_lifecycle_rules = true
s3_object_expiration_days = 60
enable_cloudfront = false
enable_s3_notifications = false

# Tags
common_tags = {
  Project = "ephemeral-environments"
  ManagedBy = "terraform"
  Environment = "demo-env-1768195876"
  Branch = "main"
  DeployedAt = "2026-01-12T05:31:17Z"
}
