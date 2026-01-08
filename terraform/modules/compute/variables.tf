# Variables for the compute module

variable "environment_name" {
  description = "Name of the environment"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "web_security_group_id" {
  description = "ID of the web security group"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "key_pair_name" {
  description = "Name of the EC2 key pair"
  type        = string
  default     = null
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

variable "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition (required if enable_ecs is true)"
  type        = string
  default     = null
}

variable "container_name" {
  description = "Name of the container in the ECS task definition"
  type        = string
  default     = "app"
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket for application assets"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket for application assets"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}