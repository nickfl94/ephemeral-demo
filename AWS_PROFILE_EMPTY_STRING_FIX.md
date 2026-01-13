# AWS Profile Empty String Fix

## Root Cause Identified
The AWS authentication was failing because the AWS CLI was trying to use an empty profile name instead of environment variables. The debug output showed:

```
The config profile () could not be found
profile    :                          : env              : ['AWS_PROFILE', 'AWS_DEFAULT_PROFILE']
```

This indicates that `AWS_PROFILE` was set to an empty string `""`, causing the AWS CLI to look for a profile named "" instead of using the environment variables directly.

## The Problem
When `AWS_PROFILE` is set to an empty string, the AWS CLI interprets this as "use profile with empty name" rather than "don't use any profile". This causes it to look for a profile configuration that doesn't exist.

## Solution Applied

### 1. Fixed Orchestrator (`src/orchestrator/demo-orchestrator.ts`)
**Before:**
```typescript
deploymentEnv.AWS_PROFILE = '';
deploymentEnv.TF_VAR_aws_profile = '';
delete deploymentEnv.AWS_PROFILE;
delete deploymentEnv.TF_VAR_aws_profile;
```

**After:**
```typescript
// Don't set AWS_PROFILE at all - let it use environment variables
delete deploymentEnv.AWS_PROFILE;
delete deploymentEnv.TF_VAR_aws_profile;
delete deploymentEnv.AWS_DEFAULT_PROFILE;
```

### 2. Enhanced Deployment Script (`deploy-infrastructure.sh`)
Added explicit profile cleanup in CI/CD environments:
```bash
# CRITICAL: Unset AWS_PROFILE completely to force use of environment variables
unset AWS_PROFILE
unset AWS_DEFAULT_PROFILE
export AWS_PROFILE=""
```

### 3. Enhanced GitHub Actions Workflow (`.github/workflows/ephemeral-environments.yml`)
Added profile cleanup steps:
```yaml
- name: Clean AWS profile environment
  run: |
    unset AWS_PROFILE
    unset AWS_DEFAULT_PROFILE

- name: Configure AWS CLI for deployment
  run: |
    unset AWS_PROFILE
    unset AWS_DEFAULT_PROFILE
    aws configure set region ${{ env.AWS_REGION }}
```

## Key Insights

### AWS CLI Profile Behavior
- `AWS_PROFILE=""` (empty string) → Look for profile named ""
- `unset AWS_PROFILE` → Use environment variables directly
- No `AWS_PROFILE` variable → Use environment variables directly

### Correct CI/CD Configuration
For GitHub Actions, the AWS CLI should use:
- `AWS_ACCESS_KEY_ID` (from secrets)
- `AWS_SECRET_ACCESS_KEY` (from secrets)  
- `AWS_DEFAULT_REGION` (from workflow)
- **NO** `AWS_PROFILE` variable at all

## Expected Result
With these fixes, the AWS CLI should now:
1. ✅ Not look for any profile configuration
2. ✅ Use environment variables directly
3. ✅ Successfully authenticate with `aws sts get-caller-identity`
4. ✅ Proceed with Terraform deployment

## Debug Output After Fix
Should show:
```bash
[INFO] AWS CLI configuration after setup:
      Name                    Value             Type    Location
      ----                    -----             ----    --------
   profile                <not set>             None    None
access_key     ****************ABCD env    
secret_key     ****************WXYZ env    
    region           ap-southeast-2      env    AWS_DEFAULT_REGION

[SUCCESS] Prerequisites check passed - using correct AWS account
```

This fix addresses the core issue of AWS profile misconfiguration in CI/CD environments.