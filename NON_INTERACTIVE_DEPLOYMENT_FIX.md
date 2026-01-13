# Non-Interactive Deployment Fix

## Problem
The GitHub Actions workflow was failing because the deployment script (`deploy-infrastructure.sh`) contains interactive prompts that require user input:
- "Continue? (y/N):" for bootstrap deployment
- "Continue? (y/N):" for main infrastructure deployment  
- "Are you sure you want to destroy everything? Type 'yes' to confirm:" for destruction

In CI/CD environments, there's no interactive terminal, so these prompts cause the deployment to hang and fail.

## Solution Applied

### 1. Updated Deployment Script
Added CI/CD detection logic to skip interactive prompts when running in automated environments:

```bash
# Skip interactive prompt in CI/CD environments
if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ] || [ "${NON_INTERACTIVE}" = "true" ]; then
    print_status "Running in CI/CD mode - auto-approving deployment"
else
    read -p "Continue? (y/N): " -n 1 -r
    # ... existing interactive logic
fi
```

### 2. Updated GitHub Actions Workflow
Added environment variables to signal CI/CD mode:

```yaml
# Set CI flags for non-interactive deployment
export CI=true
export GITHUB_ACTIONS=true
```

### 3. Updated Orchestrator
Modified the orchestrator to pass through CI environment variables:

```typescript
CI: process.env.CI || undefined,
GITHUB_ACTIONS: process.env.GITHUB_ACTIONS || undefined
```

## Fixed Interactive Prompts

### Bootstrap Deployment
- **Before**: Prompted "Continue? (y/N):" and waited for input
- **After**: Detects CI mode and auto-approves with message "Running in CI/CD mode - auto-approving bootstrap deployment"

### Main Infrastructure Deployment  
- **Before**: Prompted "Continue? (y/N):" and waited for input
- **After**: Detects CI mode and auto-approves with message "Running in CI/CD mode - auto-approving main infrastructure deployment"

### Infrastructure Destruction
- **Before**: Prompted "Are you sure you want to destroy everything? Type 'yes' to confirm:"
- **After**: Detects CI mode and auto-approves with message "Running in CI/CD mode - auto-approving destruction"

## How It Works

### Local Development (Interactive Mode)
- Environment variables `CI` and `GITHUB_ACTIONS` are not set
- Script shows interactive prompts as before
- User must manually confirm each step
- Provides safety against accidental deployments

### GitHub Actions (Non-Interactive Mode)
- Environment variables `CI=true` and `GITHUB_ACTIONS=true` are set
- Script detects CI mode and skips all interactive prompts
- Automatically proceeds with deployments
- Logs clear messages about auto-approval

### Manual Override
- Can set `NON_INTERACTIVE=true` to force non-interactive mode locally
- Useful for scripted deployments outside of GitHub Actions

## Expected Result
The next GitHub Actions run should:
1. ✅ Skip all interactive prompts
2. ✅ Auto-approve bootstrap infrastructure deployment
3. ✅ Auto-approve main infrastructure deployment  
4. ✅ Complete the full deployment without hanging
5. ✅ Post the real application URL in PR comments

The deployment will now run fully automated in CI/CD while maintaining safety prompts for local development.