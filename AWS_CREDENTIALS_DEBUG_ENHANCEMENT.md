# AWS Credentials Debug Enhancement

## Current Issue
The deployment is failing at the AWS identity verification step with:
```
[ERROR] Failed to verify AWS identity. Please check your AWS credentials.
```

Even though the credentials appear to be set correctly:
```
[INFO] AWS credentials found in environment variables
[INFO] AWS_ACCESS_KEY_ID: [SET]
[INFO] AWS_SECRET_ACCESS_KEY: [SET]
[INFO] AWS_DEFAULT_REGION: ap-southeast-2
```

## Debug Enhancements Added

### 1. Enhanced Deployment Script (`deploy-infrastructure.sh`)
- Added AWS CLI version and configuration debugging
- Enhanced error output for `aws sts get-caller-identity` failures
- Added JSON validation for AWS STS responses
- Detailed error messages for different failure scenarios
- Specific guidance for CI/CD vs local development issues

### 2. Enhanced GitHub Actions Workflow (`.github/workflows/ephemeral-environments.yml`)
- Added AWS_SESSION_TOKEN detection (for temporary credentials)
- Added network connectivity test to AWS STS endpoint
- Enhanced AWS CLI debugging output
- Better error handling and reporting

## Expected Debug Output

### Successful Case
```bash
[INFO] AWS CLI debug information:
  AWS CLI version: aws-cli/2.x.x
  AWS config list:
      Name                    Value             Type    Location
      ----                    -----             ----    --------
   profile                <not set>             None    None
access_key     ****************XXXX shared-credentials-file    
secret_key     ****************XXXX shared-credentials-file    
    region           ap-southeast-2      env    AWS_DEFAULT_REGION

[INFO] Attempting to call AWS STS...
[INFO] Current AWS Identity:
  Account ID: 911167929263
  User ARN: arn:aws:iam::911167929263:user/username
```

### Failure Cases We Can Now Diagnose

#### 1. Invalid Credentials
```bash
[ERROR] Failed to verify AWS identity. AWS CLI error:
An error occurred (InvalidUserID.NotFound) when calling the GetCallerIdentity operation: The user ID does not exist
```

#### 2. Network Issues
```bash
✗ Cannot reach AWS STS endpoint
[ERROR] Failed to verify AWS identity. AWS CLI error:
Could not connect to the endpoint URL: "https://sts.amazonaws.com/"
```

#### 3. Permissions Issues
```bash
[ERROR] Failed to verify AWS identity. AWS CLI error:
An error occurred (AccessDenied) when calling the GetCallerIdentity operation: User is not authorized to perform: sts:GetCallerIdentity
```

#### 4. Invalid JSON Response
```bash
[ERROR] AWS STS returned invalid response:
<some non-JSON error message>
[ERROR] This might indicate an authentication or permissions issue.
```

## Troubleshooting Guide

### If Network Connectivity Fails
- Check GitHub Actions runner network restrictions
- Verify AWS service availability
- Check if corporate firewall is blocking AWS endpoints

### If Credentials Are Invalid
- Verify GitHub Actions secrets are correctly set
- Check if AWS access keys are expired or deactivated
- Ensure the IAM user exists and is active

### If Permissions Are Insufficient
- Verify the IAM user has `sts:GetCallerIdentity` permission
- Check if there are any restrictive IAM policies
- Ensure the user has basic AWS access

### If Wrong Account
- Verify the AWS credentials belong to account `911167929263`
- Check if multiple AWS accounts are configured
- Ensure the correct credentials are in GitHub secrets

## Next Steps
1. Run the workflow with enhanced debugging
2. Analyze the detailed error output
3. Apply specific fixes based on the root cause identified
4. Consider alternative authentication methods if needed

The enhanced debugging should now provide clear information about exactly why the AWS authentication is failing.