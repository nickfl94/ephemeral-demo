# Terraform State Recovery Guide

## Problem: State Checksum Mismatch

When you see this error:
```
Error refreshing state: state data in S3 does not have the expected content.
The checksum calculated for the state stored in S3 does not match the checksum
stored in DynamoDB.
```

This happens when:
- Multiple Terraform operations run simultaneously
- A previous Terraform operation was interrupted
- S3 and DynamoDB became out of sync

## Quick Fix

### Automated Recovery (Recommended)

Run the recovery script:
```bash
./scripts/fix-terraform-state.sh
```

The script will:
1. Download the current state from S3
2. Calculate the correct MD5 checksum
3. Update the DynamoDB lock table with the correct checksum
4. Remove any stale locks

### Manual Recovery

If the automated script fails, manually fix it:

1. **Calculate the S3 checksum:**
   ```bash
   aws s3 cp s3://enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate /tmp/state.tfstate
   md5sum /tmp/state.tfstate
   ```

2. **Update DynamoDB:**
   ```bash
   aws dynamodb update-item \
     --table-name enigma-global-ephemeral-terraform-locks \
     --key '{"LockID": {"S": "enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate"}}' \
     --update-expression "SET Digest = :checksum" \
     --expression-attribute-values '{":checksum": {"S": "YOUR_CALCULATED_CHECKSUM_HERE"}}' \
     --region ap-southeast-2
   ```

3. **Remove any locks:**
   ```bash
   aws dynamodb delete-item \
     --table-name enigma-global-ephemeral-terraform-locks \
     --key '{"LockID": {"S": "enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate"}}' \
     --region ap-southeast-2
   ```

## Prevention

### In GitHub Actions

The workflow now includes:
- Automatic state recovery before provisioning
- Retry logic with state recovery on failures
- Up to 3 attempts to recover from state errors

### Best Practices

1. **Avoid concurrent Terraform operations** on the same state file
2. **Use workspaces or separate state keys** for different environments
3. **Enable state versioning** in S3 for backup
4. **Use proper locking** with DynamoDB (already configured)

## Understanding the Architecture

```
┌─────────────┐
│   S3 Bucket │  Stores actual state file
│  (Source of │  MD5: edde2b7f1cd9af26f653d03288a23c0c
│    Truth)   │
└──────┬──────┘
       │
       │ Should Match
       │
┌──────▼──────┐
│  DynamoDB   │  Stores checksum for validation
│  Lock Table │  MD5: 64da53ddeefe7fd862b5ea0e2048d552
│  (Stale!)   │
└─────────────┘
```

**Fix:** Update DynamoDB to match S3's checksum.

## Troubleshooting

### Script fails with permissions error
Ensure AWS credentials have permissions for:
- `s3:GetObject` on the state bucket
- `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem` on the lock table

### State file is corrupted
If the S3 state file itself is corrupted:
1. Check S3 versioning and restore a previous version
2. Use `terraform state pull` from a working environment
3. Manually upload the correct state to S3

### Multiple environments affected
If using the same state key for multiple environments:
1. Consider using Terraform workspaces
2. Use unique state keys per environment (e.g., `env-name/terraform.tfstate`)

## CI/CD Integration

The GitHub Actions workflow automatically:
1. Runs the fix script before each deployment
2. Retries provisioning up to 3 times on state errors
3. Exports proper environment variables for state management

No manual intervention needed in CI/CD pipelines.
