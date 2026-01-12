# GitHub Actions URL Extraction Fix

## Problem
The GitHub Actions workflow was posting PR comments with test/fallback URLs instead of the real deployed application URLs.

## Root Cause Analysis
1. **Terraform Output Mismatch**: The orchestrator was looking for `load_balancer_dns` but Terraform outputs `load_balancer_dns_name`
2. **Missing application_url**: The orchestrator wasn't checking for the `application_url` output first
3. **Fallback Logic Issue**: The GitHub Actions fallback wasn't properly extracting the real URL

## Fixes Applied

### 1. Fixed Orchestrator URL Generation (src/orchestrator/demo-orchestrator.ts)
**Before:**
```typescript
const applicationUrl = terraformOutputs.load_balancer_dns?.value 
  ? `http://${terraformOutputs.load_balancer_dns.value}`
  : `http://${terraformOutputs.instance_public_ip?.value || 'unknown'}:3000`;
```

**After:**
```typescript
const applicationUrl = terraformOutputs.application_url?.value 
  ? terraformOutputs.application_url.value
  : terraformOutputs.load_balancer_dns_name?.value 
  ? `http://${terraformOutputs.load_balancer_dns_name.value}`
  : `http://${terraformOutputs.instance_public_ip?.value || 'unknown'}:3000`;
```

### 2. Enhanced GitHub Actions Fallback (.github/workflows/ephemeral-environments.yml)
**Improved URL extraction logic:**
```bash
# Use the application_url output first, fallback to ALB DNS
if [ -n "$APPLICATION_URL" ] && [ "$APPLICATION_URL" != "" ]; then
  ENV_URL="$APPLICATION_URL"
elif [ -n "$ALB_DNS" ] && [ "$ALB_DNS" != "" ]; then
  ENV_URL="http://$ALB_DNS"
else
  ENV_URL="http://deployment-pending"
fi
```

### 3. Added Better Debugging
- Enhanced logging in GitHub Actions to show what URLs are being extracted
- Added validation checks for empty/null values
- Improved error handling and fallback logic

## Current Terraform Outputs
The working deployment currently provides these outputs:
```
application_url = "http://demo-env-1768205081-alb-1750288453.ap-southeast-2.elb.amazonaws.com"
load_balancer_dns_name = "demo-env-1768205081-alb-1750288453.ap-southeast-2.elb.amazonaws.com"
```

## How It Works Now

### Primary Path (CLI Success)
1. CLI calls orchestrator with updated URL extraction
2. Orchestrator gets Terraform outputs and uses `application_url` first
3. Returns real URL in JSON format: `{"data": {"urls": {"application": "http://real-url"}}}`
4. GitHub Actions extracts URL from JSON response

### Fallback Path (CLI Failure)
1. GitHub Actions runs deployment script directly
2. Extracts `application_url` from Terraform outputs
3. Falls back to `load_balancer_dns_name` if needed
4. Uses proper validation to ensure real URL is used

## Testing the Fix

### Local Testing
The CLI is working correctly:
```bash
npm run start -- status --output json
# Returns: {"success": true, "message": "No environments found", "data": []}
```

### GitHub Actions Testing
Next PR will test the complete flow:
1. CLI provisioning with real URL extraction
2. Fallback deployment with improved URL logic
3. PR comment with actual deployed application URL

## Expected Result
PR comments should now show the real deployed application URL like:
```
🚀 Ephemeral Environment Deployed

Environment ID: demo-env-branch-123456
Application URL: http://demo-env-branch-123456-alb-789.ap-southeast-2.elb.amazonaws.com
```

Instead of test URLs like `http://test-environment-pending.example.com`