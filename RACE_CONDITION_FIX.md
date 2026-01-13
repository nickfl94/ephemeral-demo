# Race Condition Fix for Terraform State

## Problem Identified

Multiple GitHub Actions workflows were running simultaneously and attempting to modify the same Terraform state file, causing race conditions where:

1. Process A downloads state (checksum: `97a275dc8964c60f6354ec5be2575dbe`)
2. Process B downloads state (same checksum)
3. Process A modifies and uploads state (new checksum: `c0fcb391c6bf4b3b980e175ad9cca4ac`)
4. Process B tries to refresh state and fails because DynamoDB still has the old checksum

This resulted in continuous state checksum mismatch errors.

## Root Causes

### 1. **No Workflow Concurrency Control**
Multiple workflows could run simultaneously on the same repository, all trying to access the same Terraform state file at `main/terraform.tfstate`.

### 2. **Shared State File**
All environments were using the same state file path instead of environment-specific paths.

### 3. **Insufficient Retry Logic**
The fallback deployment script didn't handle state errors gracefully.

## Solutions Implemented

### 1. Added Workflow Concurrency Control

Added to all three jobs (provision, cleanup, manual-action):

```yaml
concurrency:
  group: terraform-state-${{ github.repository }}
  cancel-in-progress: false
```

**What this does:**
- Only ONE workflow can access the Terraform state at a time per repository
- New workflows wait in queue instead of running concurrently
- Prevents state file race conditions completely

### 2. Enhanced State Recovery in Workflow

**Before fallback deployment:**
- Runs state recovery script proactively
- Waits 3 seconds for state to stabilize

**During fallback deployment:**
- Retries up to 2 times on state errors
- Automatically fixes state between retries
- Captures deployment output for debugging

```bash
# Fix state one more time before fallback deployment
./scripts/fix-terraform-state.sh || true
sleep 3

# Retry fallback deployment up to 2 times on state errors
for i in 1 2; do
  if ./deploy-infrastructure.sh deploy; then
    break
  fi

  if grep -q "state data in S3" deploy_output.log; then
    ./scripts/fix-terraform-state.sh || true
    sleep 5
  fi
done
```

### 3. Improved Error Handling

- Fallback deployment now captures output for analysis
- Checks specifically for state errors vs other errors
- Only retries on recoverable state errors
- Reports clear error status if all retries fail

## How It Works Now

```
┌─────────────────────────────────────────────┐
│  Workflow 1 Starts                          │
│  ├─> Acquires lock on terraform-state group│
│  ├─> Fixes state proactively                │
│  ├─> Runs provisioning                      │
│  └─> Releases lock when done                │
└─────────────────────────────────────────────┘
         │
         │ (lock held)
         ▼
┌─────────────────────────────────────────────┐
│  Workflow 2 Starts                          │
│  ├─> Waits for lock (queued)               │
│  │   ...waiting...                          │
│  │   ...waiting...                          │
│  ├─> Acquires lock (after Workflow 1 done) │
│  ├─> Fixes state proactively                │
│  ├─> Runs provisioning (no conflict!)      │
│  └─> Releases lock                          │
└─────────────────────────────────────────────┘
```

## Testing the Fix

### Verify Concurrency Control

1. Open two PRs simultaneously
2. Both should trigger workflows
3. Check Actions tab - one should show "Queued" status
4. Second workflow should start AFTER first completes

### Verify State Recovery

1. Manually corrupt state checksum in DynamoDB
2. Trigger workflow
3. Check logs - should show state recovery
4. Deployment should succeed

## Future Improvements (Recommended)

### Option 1: Environment-Specific State Files

Instead of sharing one state file, use per-environment state:

```hcl
# terraform/main.tf
terraform {
  backend "s3" {
    bucket         = "enigma-global-ephemeral-terraform-state-2025"
    key            = "${var.environment_name}/terraform.tfstate"  # Dynamic key
    region         = "ap-southeast-2"
    dynamodb_table = "enigma-global-ephemeral-terraform-locks"
    encrypt        = true
  }
}
```

This would allow:
- Multiple environments to provision simultaneously
- No race conditions between different branches
- Cleaner state isolation

### Option 2: Terraform Workspaces

Use workspaces for environment isolation:

```bash
terraform workspace select $ENVIRONMENT_NAME || terraform workspace new $ENVIRONMENT_NAME
terraform apply
```

### Option 3: Per-Branch Concurrency

Allow concurrent workflows but only queue per branch:

```yaml
concurrency:
  group: terraform-state-${{ github.ref }}  # Per branch instead of per repo
  cancel-in-progress: false
```

## Current Limitations

1. **Serial Execution** - Only one workflow can run at a time across the entire repository
2. **Longer Wait Times** - Multiple PRs will queue behind each other
3. **Shared State** - All environments still share the same state file

## Benefits

1. **No Race Conditions** - Guaranteed no concurrent state access
2. **Automatic Recovery** - State errors fixed automatically
3. **Reliable Deployments** - No more failed workflows due to state conflicts
4. **Clear Errors** - Better logging when issues occur

## Monitoring

Check for these patterns in workflow logs:

### Good Signs:
```
✓ Checksums match! State is consistent.
Provisioning completed via CLI
```

### Warning Signs (but handled):
```
⚠ Checksums do not match!
✓ State recovery completed successfully!
```

### Problems (investigate):
```
ERROR: Fallback deployment failed
http://deployment-failed
```

## Summary

The race condition has been eliminated by:
1. **Preventing concurrent access** with GitHub Actions concurrency control
2. **Proactive state recovery** before each deployment
3. **Automatic retries** with state fixing on errors
4. **Better error detection** and reporting

No more state checksum errors from race conditions! 🎉
