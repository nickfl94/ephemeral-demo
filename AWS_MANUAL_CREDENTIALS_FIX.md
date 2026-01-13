# AWS Manual Credentials Setup Fix

## Root Cause Analysis
The persistent issue with "The config profile () could not be found" indicates that the `aws-actions/configure-aws-credentials` GitHub Action is setting AWS profile environment variables that interfere with direct credential usage.

## Problem with aws-actions/configure-aws-credentials
The official AWS credentials action appears to be setting `AWS_PROFILE` or `AWS_DEFAULT_PROFILE` to empty strings, which causes the AWS CLI to look for a profile with an empty name instead of using environment variables directly.

## Solution: Manual Credentials Setup

### 1. Replaced GitHub Action with Manual Setup
**Before:**
```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ env.AWS_REGION }}
```

**After:**
```yaml
- name: Setup custom AWS credentials
  run: |
    # Set AWS credentials as environment variables
    echo "AWS_ACCESS_KEY_ID=${{ secrets.AWS_ACCESS_KEY_ID }}" >> $GITHUB_ENV
    echo "AWS_SECRET_ACCESS_KEY=${{ secrets.AWS_SECRET_ACCESS_KEY }}" >> $GITHUB_ENV
    echo "AWS_DEFAULT_REGION=${{ env.AWS_REGION }}" >> $GITHUB_ENV
    
    # Explicitly ensure no profile variables are set
    echo "AWS_PROFILE=" >> $GITHUB_ENV
    echo "AWS_DEFAULT_PROFILE=" >> $GITHUB_ENV
```

### 2. Enhanced Deployment Script with env -u
Added `env -u` usage to explicitly remove profile variables when calling AWS CLI:
```bash
# Use env -u to ensure no profile variables are passed to AWS CLI
if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
    aws_identity=$(env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws sts get-caller-identity 2>&1)
else
    aws_identity=$(aws sts get-caller-identity 2>&1)
fi
```

### 3. Aggressive Profile Variable Removal
Added multiple layers of profile variable cleanup:
```bash
# Force unset all profile-related environment variables
unset AWS_PROFILE
unset AWS_DEFAULT_PROFILE
export -n AWS_PROFILE 2>/dev/null || true
export -n AWS_DEFAULT_PROFILE 2>/dev/null || true
```

## Expected Behavior

### Manual Credentials Setup Should Show:
```bash
AWS_ACCESS_KEY_ID is set: yes
AWS_SECRET_ACCESS_KEY is set: yes
AWS_PROFILE: ''
AWS_DEFAULT_PROFILE: ''
```

### AWS CLI Configuration Should Show:
```bash
NAME                    VALUE             TYPE    LOCATION
----                    -----             ----    --------
profile                <not set>             None    None
access_key     ****************ABCD env    
secret_key     ****************WXYZ env    
region           ap-southeast-2      env    AWS_DEFAULT_REGION
```

### AWS STS Call Should Succeed:
```bash
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "911167929263",
    "Arn": "arn:aws:iam::911167929263:user/username"
}
```

## Key Advantages of Manual Setup

1. **Full Control**: Complete control over environment variables
2. **No Hidden Variables**: No risk of the action setting unwanted profile variables
3. **Explicit Configuration**: Clear visibility into what's being set
4. **Debugging Friendly**: Easy to see exactly what credentials are configured

## Fallback Strategy
If this manual approach still fails, it would indicate:
1. Invalid AWS credentials in GitHub secrets
2. Network connectivity issues from GitHub Actions runners
3. AWS service availability problems
4. IAM permission issues with the credentials

The enhanced debugging will now clearly identify which of these is the root cause.

## Files Modified
- `.github/workflows/ephemeral-environments.yml` - Replaced AWS action with manual setup
- `deploy-infrastructure.sh` - Added `env -u` usage and aggressive profile cleanup

This approach eliminates the AWS credentials action as a potential source of profile variable interference.