# GitHub Actions Integration Setup

This guide walks you through setting up the ephemeral deployment demo with GitHub Actions and AWS.

## Prerequisites

- AWS Account with appropriate permissions
- GitHub repository
- Node.js 18+ locally for testing

## Step 1: AWS Infrastructure Setup

### 1.1 Create IAM User for GitHub Actions

```bash
# Create IAM user
aws iam create-user --user-name ephemeral-demo-github-actions

# Attach the custom policy
aws iam attach-user-policy \
  --user-name ephemeral-demo-github-actions \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/EphemeralDemoPolicy

# Create access keys
aws iam create-access-key --user-name ephemeral-demo-github-actions
```

### 1.2 Create IAM Policy

```bash
# Create the IAM policy from the provided JSON
aws iam create-policy \
  --policy-name EphemeralDemoPolicy \
  --policy-document file://aws/iam-policies/ephemeral-demo-policy.json
```

### 1.3 Run AWS Setup Workflow

1. Go to your GitHub repository
2. Navigate to Actions → AWS Infrastructure Setup
3. Click "Run workflow"
4. Select environment (dev/staging/prod)
5. Run the workflow

This will create:
- S3 bucket for Terraform state
- DynamoDB table for Terraform locks
- ECR repository for Docker images
- IAM roles for EC2/ECS instances

## Step 2: GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Required Secrets

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
TERRAFORM_STATE_BUCKET=ephemeral-demo-dev-terraform-state-1234567890
TERRAFORM_STATE_TABLE=ephemeral-demo-dev-terraform-locks
ECR_REPOSITORY_URI=123456789012.dkr.ecr.us-east-1.amazonaws.com/ephemeral-demo-dev
```

### Optional Secrets

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (for notifications)
TEAMS_WEBHOOK_URL=https://outlook.office.com/... (for notifications)
```

## Step 3: Repository Configuration

### 3.1 Enable GitHub Actions

Ensure GitHub Actions are enabled in your repository settings.

### 3.2 Configure Branch Protection

Set up branch protection rules for `main` and `develop` branches:

1. Go to Settings → Branches
2. Add rule for `main`
3. Enable:
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
   - Include administrators

### 3.3 Configure Environments (Optional)

For production deployments, set up GitHub Environments:

1. Go to Settings → Environments
2. Create environments: `development`, `staging`, `production`
3. Configure protection rules and secrets per environment

## Step 4: Workflow Configuration

### 4.1 Customize Workflow Triggers

Edit `.github/workflows/ephemeral-environments.yml`:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main, develop]  # Customize branches
    paths-ignore:             # Ignore documentation changes
      - 'docs/**'
      - '*.md'
```

### 4.2 Configure Environment Variables

Update workflow environment variables:

```yaml
env:
  AWS_REGION: us-east-1        # Your preferred region
  NODE_VERSION: '18'           # Node.js version
  TERRAFORM_VERSION: '1.6.0'  # Terraform version
```

## Step 5: Testing the Integration

### 5.1 Test PR Workflow

1. Create a feature branch
2. Make a small change
3. Open a pull request
4. Verify that:
   - Environment is provisioned
   - Tests run against the environment
   - PR comment is added with environment details

### 5.2 Test Cleanup

1. Close or merge the pull request
2. Verify that:
   - Environment is destroyed
   - Cleanup comment is added to PR
   - AWS resources are removed

### 5.3 Manual Testing

```bash
# Test CLI locally
npm run build
npm run start -- provision --branch test-branch --template demo

# Check status
npm run start -- status

# Cleanup
npm run start -- cleanup --branch test-branch --force
```

## Step 6: Advanced Configuration

### 6.1 Multi-Environment Setup

For different environments (dev/staging/prod):

```yaml
strategy:
  matrix:
    environment: [dev, staging, prod]
    include:
      - environment: dev
        aws-region: us-east-1
        instance-type: t3.micro
      - environment: staging
        aws-region: us-west-2
        instance-type: t3.small
      - environment: prod
        aws-region: us-east-1
        instance-type: t3.medium
```

### 6.2 Slack/Teams Notifications

Add notification steps to workflows:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 6.3 Cost Monitoring Integration

Set up cost alerts:

```yaml
- name: Check costs
  run: |
    COST=$(npm run start -- costs --environment ${{ steps.provision.outputs.environment-id }} --output json | jq '.data.totalCost')
    if (( $(echo "$COST > 10" | bc -l) )); then
      echo "::warning::Environment cost ($COST USD) exceeds threshold"
    fi
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check IAM policies and user permissions
2. **Terraform State Lock**: Clear DynamoDB locks if needed
3. **ECR Push Failed**: Verify ECR repository exists and permissions
4. **Environment Not Ready**: Increase health check timeout

### Debug Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Terraform state
terraform state list

# Check environment status
npm run start -- status --output json

# View logs
npm run start -- logs --environment <env-id>
```

### Monitoring

Set up CloudWatch dashboards to monitor:
- Environment creation/destruction times
- Resource costs
- Error rates
- Resource utilization

## Security Best Practices

1. **Least Privilege**: Use minimal IAM permissions
2. **Secrets Management**: Store sensitive data in GitHub Secrets
3. **Network Security**: Use private subnets where possible
4. **Resource Tagging**: Tag all resources for cost tracking
5. **Cleanup Automation**: Ensure automatic cleanup works
6. **Cost Limits**: Set up billing alerts

## Next Steps

1. Set up monitoring and alerting
2. Implement cost optimization
3. Add integration tests
4. Configure production environments
5. Set up disaster recovery procedures