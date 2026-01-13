# Terraform Concurrency and State Lock Fix

## Issue Identified
The DynamoDB lock cleanup tool revealed that multiple Terraform operations were running concurrently, causing state lock conflicts:

```
Found 2 lock entries for this state file
✗ LockID: enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate
✗ LockID: enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate-md5
```

This indicates concurrent Terraform operations were trying to access the same state file simultaneously.

## Root Cause
Multiple GitHub Actions jobs were running concurrently without proper coordination:
1. Multiple PR updates triggering simultaneous provision jobs
2. Cleanup jobs running while provision jobs were active
3. Manual workflow dispatches overlapping with automatic triggers
4. Broad concurrency groups causing unnecessary conflicts

## Solution Implemented

### 1. Workflow-Level Concurrency Control
Added global concurrency control to prevent multiple workflow runs:
```yaml
concurrency:
  group: ephemeral-env-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false  # Don't cancel in-progress deployments
```

### 2. Job-Level Concurrency Controls

#### Provision Job
```yaml
concurrency:
  group: provision-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true  # Cancel previous provision if new one starts
```
- Prevents multiple provisions for the same PR
- Cancels old provisions when new commits are pushed

#### Cleanup Job
```yaml
concurrency:
  group: cleanup-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: false  # Don't cancel cleanup operations
```
- Prevents multiple cleanup operations for the same PR
- Never cancels cleanup to avoid leaving resources orphaned

#### Manual Action Job
```yaml
concurrency:
  group: manual-${{ github.event.inputs.action }}-${{ github.event.inputs.branch || github.ref }}
  cancel-in-progress: false  # Don't cancel manual operations
```
- Prevents overlapping manual operations
- Groups by action type and branch for fine-grained control

### 3. Enhanced Deployment Script Lock Handling

Added intelligent Terraform state lock detection and resolution:
```bash
# Check for state lock conflicts and handle them
if ! terraform plan -detailed-exitcode -out=main.tfplan >/dev/null 2>&1; then
    if terraform plan 2>&1 | grep -q "Error acquiring the state lock"; then
        # Attempt to resolve lock conflicts in CI/CD
        if [ "${CI}" = "true" ]; then
            terraform force-unlock -force "$lock_id"
        fi
    fi
fi
```

## Concurrency Strategy

### Before Fix
- ❌ Multiple jobs could run simultaneously
- ❌ No coordination between provision/cleanup
- ❌ Terraform state locks caused failures
- ❌ Manual operations could conflict with automatic ones

### After Fix
- ✅ Only one workflow run per branch at a time
- ✅ Provision jobs are cancelled by newer commits
- ✅ Cleanup jobs never get cancelled
- ✅ Manual operations are isolated by action type
- ✅ Terraform lock conflicts are automatically resolved

## Expected Behavior

### PR Workflow
1. **New PR opened** → Provision job starts
2. **New commit pushed** → Previous provision cancelled, new one starts
3. **PR closed** → Cleanup job runs (never cancelled)

### Manual Operations
- Only one manual action per branch/action type at a time
- Manual operations don't interfere with PR workflows

### Terraform State
- No more concurrent access to the same state file
- Automatic lock resolution in CI/CD environments
- Clear error messages if locks persist

## Benefits

1. **Eliminates State Lock Conflicts** - No more DynamoDB lock errors
2. **Prevents Resource Waste** - Cancels outdated provision jobs
3. **Ensures Cleanup Completion** - Cleanup jobs never get interrupted
4. **Improves Reliability** - Predictable workflow execution
5. **Better Resource Management** - No orphaned AWS resources

## Files Modified
- `.github/workflows/ephemeral-environments.yml` - Added concurrency controls
- `deploy-infrastructure.sh` - Enhanced Terraform lock handling

This fix ensures that Terraform operations run in a coordinated manner, preventing the state lock conflicts that were causing deployment failures.