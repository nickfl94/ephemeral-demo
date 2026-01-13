# AWS Profile CI/CD Fix Summary

## Issue
GitHub Actions workflow was failing with the error:
```
Error: failed to get shared config profile, nick_fletcher-911167929263
```

This occurred because the Terraform configuration was trying to use a local AWS profile that doesn't exist in the CI/CD environment.

## Root Cause
1. The orchestrator was setting `AWS_PROFILE` and `TF_VAR_aws_profile` environment variables even in CI/CD environments
2. The main Terraform configuration (`terraform/main.tf`) didn't have proper profile handling like the bootstrap configuration
3. The deployment script wasn't properly configuring the `aws_profile` variable in `terraform.tfvars`

## Solution

### 1. Updated Orchestrator (`src/orchestrator/demo-orchestrator.ts`)
- Added CI/CD detection to clear AWS profile variables when running in GitHub Actions
- In CI/CD environments: removes `AWS_PROFILE` and `TF_VAR_aws_profile` to use direct credentials
- In local development: preserves existing profile configuration

### 2. Updated Main Terraform Configuration (`terraform/main.tf`)
- Added profile configuration to AWS provider to match bootstrap configuration
- Uses `var.aws_profile` with null fallback for CI/CD environments

### 3. Added AWS Profile Variable (`terraform/variables.tf`)
- Added `aws_profile` variable with empty string default
- Allows profile to be set via Terraform variables or environment

### 4. Updated Deployment Script (`deploy-infrastructure.sh`)
- Enhanced `create_terraform_vars()` function to properly set `aws_profile` in `terraform.tfvars`
- CI/CD environments: sets `aws_profile = ""`
- Local development: uses `$AWS_PROFILE` if set, otherwise empty string

## Configuration Behavior

### CI/CD Environment (GitHub Actions)
- Uses direct AWS credentials from secrets
- No AWS profile specified (`aws_profile = ""`)
- Terraform uses default credential chain

### Local Development
- Uses AWS profile if `AWS_PROFILE` environment variable is set
- Falls back to default credentials if no profile specified
- Maintains existing local development workflow

## Testing
- ✅ CLI builds successfully
- ✅ TypeScript compilation passes
- ✅ Profile handling logic implemented correctly
- 🔄 Ready for GitHub Actions testing

## Files Modified
- `src/orchestrator/demo-orchestrator.ts` - Fixed profile handling in CI/CD
- `terraform/main.tf` - Added profile configuration to AWS provider
- `terraform/variables.tf` - Added aws_profile variable
- `deploy-infrastructure.sh` - Enhanced terraform.tfvars generation

This fix ensures that the same codebase works correctly in both local development (with AWS profiles) and CI/CD environments (with direct credentials).