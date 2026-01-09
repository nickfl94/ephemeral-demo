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
  region  = var.aws_region
  profile = var.aws_profile
  
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
  
  environment_name = var.environment_name
  vpc_cidr        = var.vpc_cidr
  
  tags = var.common_tags
}

module "storage" {
  source = "./modules/storage"
  
  environment_name = var.environment_name
  
  tags = var.common_tags
}

module "compute" {
  source = "./modules/compute"
  
  environment_name = var.environment_name
  vpc_id          = module.networking.vpc_id
  subnet_ids      = module.networking.private_subnet_ids
  
  tags = var.common_tags
}

module "monitoring" {
  source = "./modules/monitoring"
  
  environment_name = var.environment_name
  
  tags = var.common_tags
}