# Quick Fix Guide - Terraform State Issues

## If you see: "state data in S3 does not have the expected content"

### Automatic Fix (GitHub Actions)
**Do nothing!** The workflow now handles this automatically:
- Fixes state before provisioning
- Retries with recovery on failures
- Uses fallback deployment if needed

### Manual Fix (Local Development)

**Option 1: Use the script**
```bash
./scripts/fix-terraform-state.sh
```

**Option 2: One-line fix**
```bash
aws dynamodb update-item \
  --table-name enigma-global-ephemeral-terraform-locks \
  --key '{"LockID": {"S": "enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate"}}' \
  --update-expression "SET Digest = :checksum" \
  --expression-attribute-values '{"::checksum": {"S": "CHECKSUM_FROM_ERROR_MESSAGE"}}' \
  --region ap-southeast-2
```

Replace `CHECKSUM_FROM_ERROR_MESSAGE` with the "Calculated checksum" from the error.

## If workflows are queued

**This is normal!** Concurrency control prevents race conditions:
- Only one workflow runs at a time
- Others wait in queue
- Ensures no state conflicts

## If deployment fails after retries

Check the workflow logs for:
1. The actual error (not just state checksum)
2. Whether it's an AWS permissions issue
3. Whether resources already exist

## Key Files

- [.github/workflows/ephemeral-environments.yml](.github/workflows/ephemeral-environments.yml) - Main workflow
- [scripts/fix-terraform-state.sh](scripts/fix-terraform-state.sh) - State recovery script
- [scripts/README-STATE-RECOVERY.md](scripts/README-STATE-RECOVERY.md) - Detailed recovery guide
- [RACE_CONDITION_FIX.md](RACE_CONDITION_FIX.md) - Complete solution explanation

## Emergency: Clear State Lock

If a workflow crashes and leaves a lock:

```bash
aws dynamodb delete-item \
  --table-name enigma-global-ephemeral-terraform-locks \
  --key '{"LockID": {"S": "enigma-global-ephemeral-terraform-state-2025/main/terraform.tfstate"}}' \
  --region ap-southeast-2
```

Then run the fix script:
```bash
./scripts/fix-terraform-state.sh
```

## Contact

If issues persist after all fixes:
1. Check [RACE_CONDITION_FIX.md](RACE_CONDITION_FIX.md) for detailed explanation
2. Review [scripts/README-STATE-RECOVERY.md](scripts/README-STATE-RECOVERY.md) for troubleshooting
3. Check GitHub Actions logs for specific errors
