# Variables for main Terraform configuration

variable "environment_name" {
  description = "Name of the environment"
  type        = string
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-southeast-2"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_count" {
  description = "Number of public subnets to create"
  type        = number
  default     = 2
}

variable "private_subnet_count" {
  description = "Number of private subnets to create"
  type        = number
  default     = 2
}

variable "enable_nat_gateway" {
  description = "Whether to create a NAT gateway for private subnets"
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "ephemeral-environments"
    ManagedBy = "terraform"
  }
}

# EC2 Configuration Variables
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "min_instances" {
  description = "Minimum number of instances in the Auto Scaling Group"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances in the Auto Scaling Group"
  type        = number
  default     = 3
}

variable "desired_instances" {
  description = "Desired number of instances in the Auto Scaling Group"
  type        = number
  default     = 1
}

variable "application_port" {
  description = "Port number for the application"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Path for health checks"
  type        = string
  default     = "/health"
}

variable "enable_load_balancer" {
  description = "Whether to create an Application Load Balancer"
  type        = bool
  default     = true
}

variable "enable_ecs" {
  description = "Whether to create ECS resources"
  type        = bool
  default     = false
}

# Monitoring Configuration Variables
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

# Storage Configuration Variables
variable "enable_s3_versioning" {
  description = "Whether to enable S3 bucket versioning"
  type        = bool
  default     = false
}

variable "enable_s3_public_read" {
  description = "Whether to allow public read access to the assets bucket"
  type        = bool
  default     = false
}

variable "enable_s3_lifecycle_rules" {
  description = "Whether to enable S3 lifecycle rules for cost optimization"
  type        = bool
  default     = true
}

variable "s3_object_expiration_days" {
  description = "Number of days after which objects will be deleted"
  type        = number
  default     = 30
}

variable "enable_cloudfront" {
  description = "Whether to create a CloudFront distribution for static assets"
  type        = bool
  default     = false
}

variable "enable_s3_notifications" {
  description = "Whether to enable S3 bucket notifications"
  type        = bool
  default     = false
}
# Application Configuration Variables
variable "branch_name" {
  description = "Git branch name for this environment"
  type        = string
  default     = "main"
}

variable "app_version" {
  description = "Application version"
  type        = string
  default     = "1.0.0"
}

variable "build_number" {
  description = "Build number"
  type        = string
  default     = "local"
}

variable "git_commit" {
  description = "Git commit hash"
  type        = string
  default     = "unknown"
}