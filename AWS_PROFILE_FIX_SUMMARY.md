# AWS Profile Configuration Fix

## Problem
The GitHub Actions workflow was failing with the error:
```
Error: failed to get shared config profile, nick_fletcher-911167929263
```

This happened because the Terraform configuration was trying to use a specific AWS profile that doesn't exist in the GitHub Actions environment.

## Root Cause
1. The orchestrator was hardcoding `AWS_PROFILE=nick_fletcher-911167929263`
2. The bootstrap Terraform configuration required an AWS profile
3. GitHub Actions should use AWS credentials directly, not profiles

## Fixes Applied

### 1. Updated Orchestrator (src/orchestrator/demo-orchestrator.ts)
- Changed `AWS_PROFILE: process.env.AWS_PROFILE || 'nick_fletcher-911167929263'` 
- To: `AWS_PROFILE: process.env.AWS_PROFILE || undefined`
- Updated logging to handle undefined profile gracefully

### 2. Updated Bootstrap Terraform (terraform/bootstrap/main.tf)
- Made AWS profile optional in provider configuration
- Changed from: `profile = var.aws_profile`
- To: `profile = var.aws_profile != "" ? var.aws_profile : null`

### 3. Updated Bootstrap Variables (terraform/bootstrap/variables.tf)
- Made aws_profile variable optional with empty string default
- Changed from: `default = "default"`
- To: `default = ""`

### 4. Updated Example Configurations
- Removed aws_profile from terraform/terraform.tfvars.example
- Made aws_profile optional in terraform/bootstrap/terraform.tfvars.example

## How It Works Now

### Local Development
- Users can set `AWS_PROFILE=their-profile-name` environment variable
- Or rely on default AWS CLI configuration

### GitHub Actions
- Uses AWS credentials directly via `aws-actions/configure-aws-credentials`
- No AWS_PROFILE environment variable needed
- Terraform uses the configured credentials automatically

## Testing
The fix allows the workflow to work in both environments:
1. **Local**: Can use AWS profiles if needed
2. **GitHub Actions**: Uses direct AWS credentials without profiles

## Next Steps
1. Test the GitHub Actions workflow with a new PR
2. Verify that Terraform can now authenticate properly
3. Confirm that the deployment completes successfully