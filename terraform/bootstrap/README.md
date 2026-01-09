# Terraform Bootstrap Configuration

This directory contains the bootstrap Terraform configuration that creates the S3 bucket and DynamoDB table required for remote state management.

## Purpose

Before you can use Terraform with remote state backend, you need:
1. An S3 bucket to store the state files
2. A DynamoDB table for state locking (prevents concurrent modifications)

This bootstrap configuration creates these resources.

## Usage

### 1. Initial Setup

```bash
cd terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your desired values:
```hcl
state_bucket_name    = "mycompany-ephemeral-terraform-state"
dynamodb_table_name  = "mycompany-ephemeral-terraform-locks"
aws_region          = "us-east-1"
```

### 2. Deploy Bootstrap Resources

```bash
# Initialize Terraform (uses local state initially)
terraform init

# Plan the deployment
terraform plan

# Apply the configuration
terraform apply
```

### 3. Configure GitHub Secrets

After deployment, add these secrets to your GitHub repository:

- `TERRAFORM_STATE_BUCKET`: The S3 bucket name (from terraform output)
- `TERRAFORM_STATE_TABLE`: The DynamoDB table name (from terraform output)

You can get these values from:
```bash
terraform output state_bucket_name
terraform output dynamodb_table_name
```

### 4. Migrate to Remote State (Optional)

After creating the resources, you can migrate this bootstrap configuration to use remote state:

1. Add backend configuration to `main.tf`:
```hcl
terraform {
  backend "s3" {
    bucket         = "your-bucket-name"
    key            = "bootstrap/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "your-table-name"
  }
}
```

2. Reinitialize and migrate:
```bash
terraform init -migrate-state
```

## Security Notes

- The S3 bucket is configured with:
  - Versioning enabled
  - Server-side encryption
  - Public access blocked
- The DynamoDB table uses pay-per-request billing
- An IAM policy is created for proper access permissions

## Cleanup

To destroy the bootstrap resources (only do this if you're sure):
```bash
terraform destroy
```

**Warning**: This will delete your Terraform state storage. Make sure you've backed up any important state files first.