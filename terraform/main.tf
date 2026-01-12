# Main Terraform configuration for ephemeral environments
# Uses remote state backend created by bootstrap configuration

terraform {
  required_version = ">= 1.0"
  
  # Remote state backend configuration
  backend "s3" {
    bucket         = "enigma-global-ephemeral-terraform-state-2025"
    key            = "main/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "enigma-global-ephemeral-terraform-locks"
    encrypt        = true
  }
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region
  # Profile will be determined by AWS_PROFILE environment variable or default AWS CLI profile
  
  default_tags {
    tags = {
      Project     = "ephemeral-environments"
      ManagedBy   = "terraform"
      Environment = var.environment_name
    }
  }
}

# Example usage of your modules
module "networking" {
  source = "./modules/networking"
  
  environment_name      = var.environment_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_count  = var.public_subnet_count
  private_subnet_count = var.private_subnet_count
  enable_nat_gateway   = var.enable_nat_gateway
  application_port     = var.application_port
  
  tags = var.common_tags
}

module "storage" {
  source = "./modules/storage"
  
  environment_name        = var.environment_name
  enable_versioning       = var.enable_s3_versioning
  enable_public_read      = var.enable_s3_public_read
  enable_lifecycle_rules  = var.enable_s3_lifecycle_rules
  object_expiration_days  = var.s3_object_expiration_days
  enable_cloudfront       = var.enable_cloudfront
  enable_notifications    = var.enable_s3_notifications
  
  tags = var.common_tags
}

module "compute" {
  source = "./modules/compute"
  
  environment_name        = var.environment_name
  vpc_id                 = module.networking.vpc_id
  public_subnet_ids      = module.networking.public_subnet_ids
  private_subnet_ids     = module.networking.private_subnet_ids
  web_security_group_id  = module.networking.web_security_group_id
  s3_bucket_name         = module.storage.assets_bucket_name
  s3_bucket_arn          = module.storage.assets_bucket_arn
  
  # EC2 Configuration
  instance_type      = var.instance_type
  min_instances      = var.min_instances
  max_instances      = var.max_instances
  desired_instances  = var.desired_instances
  application_port   = var.application_port
  health_check_path  = var.health_check_path
  
  # Application Configuration
  branch_name        = var.branch_name
  aws_region         = var.aws_region
  app_version        = var.app_version
  build_number       = var.build_number
  git_commit         = var.git_commit
  
  # Optional features
  enable_load_balancer = var.enable_load_balancer
  enable_ecs          = var.enable_ecs
  
  tags = var.common_tags
}

module "monitoring" {
  source = "./modules/monitoring"
  
  environment_name         = var.environment_name
  aws_region              = var.aws_region
  log_group_name          = module.compute.cloudwatch_log_group_name
  autoscaling_group_name  = module.compute.autoscaling_group_name
  load_balancer_arn_suffix = var.enable_load_balancer ? "placeholder" : null
  target_group_arn_suffix  = var.enable_load_balancer ? "placeholder" : null
  
  # Monitoring thresholds
  cpu_threshold           = var.cpu_threshold
  memory_threshold        = var.memory_threshold
  response_time_threshold = var.response_time_threshold
  error_rate_threshold    = var.error_rate_threshold
  min_healthy_targets     = var.min_healthy_targets
  
  # Feature flags
  enable_load_balancer  = var.enable_load_balancer
  create_sns_topic      = var.create_sns_topic
  notification_email    = var.notification_email
  enable_custom_metrics = var.enable_custom_metrics
  
  tags = var.common_tags
  
  depends_on = [module.compute]
}