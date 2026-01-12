# AWS Profile CI/CD Fix Summary

## Problem
The GitHub Actions workflow was failing because Terraform was trying to use the AWS profile `nick_fletcher-911167929263` which doesn't exist in the CI environment, even though AWS credentials were properly configured.

## Root Cause
- **Local Development**: Uses AWS profile `nick_fletcher-911167929263` (correct)
- **GitHub Actions**: Should use direct AWS credentials from `aws-actions/configure-aws-credentials` (no profile)
- **Issue**: Terraform was always trying to use the profile from `terraform.tfvars` regardless of environment

## Solution Applied

### 1. GitHub Actions Environment Variables
Updated the workflow to override the AWS profile for CI/CD:
```bash
# Override AWS profile for CI/CD - use direct credentials instead of profile
export AWS_PROFILE=""
export TF_VAR_aws_profile=""
```

### 2. Bootstrap Terraform Configuration
Updated `terraform/bootstrap/main.tf` to respect the TF_VAR override:
```hcl
provider "aws" {
  region = var.aws_region
  # Use profile from variable, which can be overridden by TF_VAR_aws_profile
  profile = var.aws_profile != "" ? var.aws_profile : null
}
```

### 3. Orchestrator Environment Variables
Updated `src/orchestrator/demo-orchestrator.ts` to pass through the TF_VAR override:
```typescript
AWS_PROFILE: process.env.AWS_PROFILE || undefined,
TF_VAR_aws_profile: process.env.TF_VAR_aws_profile || process.env.AWS_PROFILE || undefined
```

## How It Works Now

### Local Development
- Uses `terraform/bootstrap/terraform.tfvars` with `aws_profile = "nick_fletcher-911167929263"`
- Terraform uses the specified profile
- Works with your local AWS configuration

### GitHub Actions CI/CD
- Sets `AWS_PROFILE=""` and `TF_VAR_aws_profile=""`
- Terraform receives empty profile variable → uses `null` profile
- Falls back to default AWS credentials from `aws-actions/configure-aws-credentials`
- Uses the correct AWS account (911167929263) with direct credentials

## Configuration Files

### terraform/bootstrap/terraform.tfvars (unchanged)
```hcl
state_bucket_name    = "enigma-global-ephemeral-terraform-state-2025"
dynamodb_table_name  = "enigma-global-ephemeral-terraform-locks"
aws_region          = "ap-southeast-2"
aws_profile         = "nick_fletcher-911167929263"
```

### GitHub Actions Workflow
```yaml
# Set environment variables for deployment
export AWS_PROFILE=""
export TF_VAR_aws_profile=""
```

## Expected Result
- **Local**: Uses `nick_fletcher-911167929263` profile ✅
- **GitHub Actions**: Uses direct AWS credentials (no profile) ✅
- **Both**: Deploy to the same AWS account (911167929263) ✅

The next PR should now successfully provision infrastructure without AWS profile errors.