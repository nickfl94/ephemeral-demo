#!/bin/bash
# Deployment script for ephemeral environment infrastructure
# This script will deploy the complete AWS infrastructure using Terraform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-demo-env-$(date +%s)}"
BRANCH_NAME="${BRANCH_NAME:-main}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
APP_VERSION="${APP_VERSION:-1.0.0}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%s)}"
GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to create terraform.tfvars with all required variables
create_terraform_vars() {
    print_status "Creating terraform.tfvars with deployment configuration..."
    
    # Determine AWS profile setting based on environment
    local aws_profile_setting=""
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
        # In CI/CD, don't use any profile (use direct credentials)
        aws_profile_setting='aws_profile = ""'
    elif [ -n "${AWS_PROFILE}" ]; then
        # In local development with profile set
        aws_profile_setting="aws_profile = \"${AWS_PROFILE}\""
    else
        # In local development without profile (use default)
        aws_profile_setting='aws_profile = ""'
    fi
    
    # Write to current directory (should be terraform directory when called)
    cat > terraform.tfvars << EOF
# Environment Configuration
environment_name = "$ENVIRONMENT_NAME"
aws_region = "$AWS_REGION"
$aws_profile_setting

# Application Configuration  
branch_name = "$BRANCH_NAME"
app_version = "$APP_VERSION"
build_number = "$BUILD_NUMBER"
git_commit = "$GIT_COMMIT"

# Infrastructure Configuration
instance_type = "t3.micro"
application_port = 3000
health_check_path = "/health"
min_instances = 1
max_instances = 3
desired_instances = 1

# Feature flags
enable_load_balancer = true
enable_ecs = false
enable_nat_gateway = true

# Network Configuration
vpc_cidr = "10.0.0.0/16"
public_subnet_count = 2
private_subnet_count = 2

# S3 Configuration
enable_s3_versioning = false
enable_s3_public_read = false
enable_s3_lifecycle_rules = true
s3_object_expiration_days = 60
enable_cloudfront = false
enable_s3_notifications = false

# Tags
common_tags = {
  Project = "ephemeral-environments"
  ManagedBy = "terraform"
  Environment = "$ENVIRONMENT_NAME"
  Branch = "$BRANCH_NAME"
  DeployedAt = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    print_success "Created terraform.tfvars with configuration for environment: $ENVIRONMENT_NAME"
    print_status "AWS Profile setting: $aws_profile_setting"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists terraform; then
        print_error "Terraform is not installed. Please install Terraform first."
        exit 1
    fi
    
    if ! command_exists aws; then
        print_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check AWS credentials - handle both CI/CD and local environments
    print_status "Checking AWS credentials..."
    
    # In CI/CD environments, credentials come from environment variables
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
        print_status "Running in CI/CD environment - checking environment variables..."
        
        if [ -z "${AWS_ACCESS_KEY_ID}" ] || [ -z "${AWS_SECRET_ACCESS_KEY}" ]; then
            print_error "AWS credentials not found in environment variables."
            print_error "Required: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
            print_error "Current environment:"
            echo "  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:+[SET]}"
            echo "  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:+[SET]}"
            echo "  AWS_DEFAULT_REGION: ${AWS_DEFAULT_REGION:-[NOT SET]}"
            echo "  AWS_REGION: ${AWS_REGION:-[NOT SET]}"
            exit 1
        fi
        
        # CRITICAL: Unset AWS_PROFILE completely to force use of environment variables
        unset AWS_PROFILE
        unset AWS_DEFAULT_PROFILE
        export AWS_PROFILE=""
        
        # Set AWS region if not already set
        if [ -z "${AWS_DEFAULT_REGION}" ]; then
            export AWS_DEFAULT_REGION="${AWS_REGION}"
            print_status "Set AWS_DEFAULT_REGION to: ${AWS_REGION}"
        fi
        
        print_status "AWS credentials found in environment variables"
        print_status "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:+[SET]}"
        print_status "AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:+[SET]}"
        print_status "AWS_DEFAULT_REGION: ${AWS_DEFAULT_REGION}"
        print_status "Cleared AWS_PROFILE to force environment variable usage"
    else
        # In local development, check AWS CLI configuration
        if ! aws sts get-caller-identity >/dev/null 2>&1; then
            print_error "AWS credentials not configured. Please run 'aws configure' first."
            exit 1
        fi
    fi
    
    # Try to get AWS identity (works for both credential methods)
    print_status "Verifying AWS identity..."
    
    # CRITICAL: Force unset all profile-related environment variables
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
        print_status "Forcing removal of all AWS profile environment variables..."
        unset AWS_PROFILE
        unset AWS_DEFAULT_PROFILE
        # Also remove from current shell environment
        export -n AWS_PROFILE 2>/dev/null || true
        export -n AWS_DEFAULT_PROFILE 2>/dev/null || true
        
        # Verify they are gone
        if [ -n "${AWS_PROFILE+x}" ]; then
            print_warning "AWS_PROFILE still set: '${AWS_PROFILE}'"
        else
            print_status "AWS_PROFILE successfully unset"
        fi
        
        if [ -n "${AWS_DEFAULT_PROFILE+x}" ]; then
            print_warning "AWS_DEFAULT_PROFILE still set: '${AWS_DEFAULT_PROFILE}'"
        else
            print_status "AWS_DEFAULT_PROFILE successfully unset"
        fi
    fi
    
    # Debug AWS CLI configuration
    print_status "AWS CLI debug information:"
    echo "  AWS CLI version: $(aws --version 2>&1)"
    echo "  AWS config list:"
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
        env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws configure list 2>&1 || echo "  Failed to get AWS config list"
    else
        aws configure list 2>&1 || echo "  Failed to get AWS config list"
    fi
    
    # Try to get caller identity with detailed error output and retry logic
    print_status "Attempting to call AWS STS..."
    local aws_identity
    local aws_error
    local retry_count=0
    local max_retries=3
    
    while [ $retry_count -lt $max_retries ]; do
        # Use env -u to ensure no profile variables are passed to AWS CLI
        if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
            print_status "Using env -u to call AWS CLI without profile variables (attempt $((retry_count + 1)))"
            aws_identity=$(env -u AWS_PROFILE -u AWS_DEFAULT_PROFILE aws sts get-caller-identity 2>&1)
        else
            aws_identity=$(aws sts get-caller-identity 2>&1)
        fi
        
        if [ $? -eq 0 ]; then
            # Check if the output is actually valid JSON (sometimes aws returns error as stdout)
            if echo "$aws_identity" | jq . >/dev/null 2>&1; then
                break
            else
                print_warning "AWS STS returned invalid JSON (attempt $((retry_count + 1))/$max_retries):"
                echo "$aws_identity"
            fi
        else
            print_warning "AWS STS call failed (attempt $((retry_count + 1))/$max_retries)"
            echo "Error output: $aws_identity"
        fi
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            print_status "Retrying in 2 seconds..."
            sleep 2
        fi
    done
    
    # Check if we succeeded after retries
    if [ $retry_count -eq $max_retries ]; then
        aws_error="$aws_identity"
        print_error "Failed to verify AWS identity after $max_retries attempts. AWS CLI error:"
        echo "$aws_error"
        print_error ""
        print_error "Possible causes:"
        print_error "1. Invalid AWS credentials"
        print_error "2. Network connectivity issues"
        print_error "3. AWS service unavailable"
        print_error "4. Insufficient permissions for sts:GetCallerIdentity"
        
        if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
            print_error ""
            print_error "In CI/CD environment, check:"
            print_error "- GitHub Actions secrets are correctly configured"
            print_error "- AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are valid"
            print_error "- The IAM user has sts:GetCallerIdentity permission"
        fi
        exit 1
    fi
    
    # If we get here, we have a valid response
    # If we get here, we have a valid response
    local account_id=$(echo "$aws_identity" | jq -r '.Account' 2>/dev/null || echo "unknown")
    local user_arn=$(echo "$aws_identity" | jq -r '.Arn' 2>/dev/null || echo "unknown")
    
    print_status "Current AWS Identity:"
    echo "  Account ID: $account_id"
    echo "  User ARN: $user_arn"
    echo "  AWS Profile: ${AWS_PROFILE:-default}"
    echo "  AWS Region: ${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || echo $AWS_REGION)}"
    
    # Verify we're using the correct account
    if [ "$account_id" != "911167929263" ]; then
        print_error "Wrong AWS account! Expected: 911167929263, Got: $account_id"
        if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ]; then
            print_error "Please check your GitHub Actions AWS credentials configuration"
        else
            print_error "Please switch to the correct AWS profile:"
            print_error "  export AWS_PROFILE=your-profile-for-911167929263"
        fi
        exit 1
    fi
    
    print_success "Prerequisites check passed - using correct AWS account"
}

# Function to deploy bootstrap infrastructure
deploy_bootstrap() {
    print_status "Checking bootstrap infrastructure (S3 backend)..."
    
    cd terraform/bootstrap
    
    if [ ! -f "terraform.tfvars" ]; then
        print_error "terraform.tfvars not found in bootstrap directory"
        print_status "Please create terraform.tfvars based on terraform.tfvars.example"
        exit 1
    fi
    
    # Get bucket name from terraform.tfvars
    BUCKET_NAME=$(grep "state_bucket_name" terraform.tfvars | cut -d'"' -f2)
    TABLE_NAME=$(grep "dynamodb_table_name" terraform.tfvars | cut -d'"' -f2)
    
    # Check if S3 bucket already exists and is accessible
    if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null && aws dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
        print_status "Bootstrap infrastructure already exists and is accessible:"
        print_status "  S3 bucket: $BUCKET_NAME"
        print_status "  DynamoDB table: $TABLE_NAME"
        print_status "Skipping bootstrap deployment"
        cd ../..
        return 0
    fi
    
    print_status "Bootstrap infrastructure not found or not accessible - deploying..."
    
    # Verify AWS credentials before bootstrap
    local current_identity=$(aws sts get-caller-identity)
    local current_account=$(echo "$current_identity" | jq -r '.Account' 2>/dev/null || echo "unknown")
    print_status "Bootstrap will use AWS Account: $current_account"
    
    if [ "$current_account" != "911167929263" ]; then
        print_error "AWS account mismatch! Bootstrap will use account $current_account instead of 911167929263"
        exit 1
    fi
    
    terraform init
    terraform plan -out=bootstrap.tfplan
    
    print_warning "About to deploy bootstrap infrastructure. This will create:"
    print_warning "- S3 bucket for Terraform state"
    print_warning "- DynamoDB table for state locking"
    
    # Skip interactive prompt in CI/CD environments
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ] || [ "${NON_INTERACTIVE}" = "true" ]; then
        print_status "Running in CI/CD mode - auto-approving bootstrap deployment"
    else
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Bootstrap deployment cancelled"
            exit 0
        fi
    fi
    
    terraform apply bootstrap.tfplan
    
    print_success "Bootstrap infrastructure deployed successfully"
    cd ../..
}

# Function to deploy main infrastructure
deploy_main() {
    print_status "Deploying main infrastructure..."
    
    cd terraform
    
    # Ensure Terraform uses the same AWS credentials as the current shell
    export TF_VAR_aws_region="${AWS_DEFAULT_REGION:-ap-southeast-2}"
    
    # Show current AWS identity before Terraform operations
    print_status "Verifying AWS credentials for Terraform..."
    local current_identity=$(aws sts get-caller-identity)
    local current_account=$(echo "$current_identity" | jq -r '.Account' 2>/dev/null || echo "unknown")
    print_status "Terraform will use AWS Account: $current_account"
    
    if [ "$current_account" != "911167929263" ]; then
        print_error "AWS account mismatch! Terraform will use account $current_account instead of 911167929263"
        exit 1
    fi
    
    # Create terraform.tfvars with all required variables
    create_terraform_vars
    
    # Initialize Terraform with remote backend
    print_status "Initializing Terraform..."
    terraform init
    
    # Plan the deployment
    print_status "Planning deployment..."
    terraform plan -out=main.tfplan
    
    print_warning "About to deploy main infrastructure for environment: $ENVIRONMENT_NAME"
    print_warning "This will create:"
    print_warning "- VPC with public and private subnets"
    print_warning "- Security groups (allowing port 3000)"
    print_warning "- Application Load Balancer with health checks"
    print_warning "- Auto Scaling Group with EC2 instances"
    print_warning "- S3 buckets for application data"
    print_warning "- CloudWatch log groups and monitoring"
    print_warning "- IAM roles and policies"
    print_warning ""
    print_warning "Configuration:"
    print_warning "  Environment: $ENVIRONMENT_NAME"
    print_warning "  Branch: $BRANCH_NAME"
    print_warning "  Region: $AWS_REGION"
    print_warning "  App Version: $APP_VERSION"
    
    # Skip interactive prompt in CI/CD environments
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ] || [ "${NON_INTERACTIVE}" = "true" ]; then
        print_status "Running in CI/CD mode - auto-approving main infrastructure deployment"
    else
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Main infrastructure deployment cancelled"
            exit 0
        fi
    fi
    
    # Apply the plan
    print_status "Applying Terraform plan..."
    terraform apply -auto-approve main.tfplan
    
    print_success "Main infrastructure deployed successfully"
    
    # Show outputs
    print_status "Infrastructure outputs:"
    terraform output
    
    cd ..
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    cd terraform
    
    # Get the application URL
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "")
    
    if [ -n "$APP_URL" ]; then
        print_status "Application URL: $APP_URL"
        print_status "Waiting for application to be ready..."
        
        # Wait for the application to be ready (up to 5 minutes)
        for i in {1..30}; do
            if curl -s -f "$APP_URL/health" >/dev/null 2>&1; then
                print_success "Application is responding at $APP_URL"
                break
            else
                print_status "Waiting for application... (attempt $i/30)"
                sleep 10
            fi
        done
        
        if ! curl -s -f "$APP_URL/health" >/dev/null 2>&1; then
            print_warning "Application may not be fully ready yet. Check the load balancer and instances."
        fi
    else
        print_warning "Could not retrieve application URL from Terraform outputs"
    fi
    
    cd ..
}

# Function to show deployment information
show_info() {
    print_status "Deployment Information:"
    echo
    
    cd terraform
    
    echo "=== Infrastructure Outputs ==="
    terraform output
    echo
    
    echo "=== AWS Resources Created ==="
    echo "- VPC with public and private subnets"
    echo "- Internet Gateway and NAT Gateway"
    echo "- Security Groups (web, database, internal)"
    echo "- Application Load Balancer"
    echo "- Auto Scaling Group with EC2 instances"
    echo "- S3 buckets for application assets and data"
    echo "- CloudWatch log groups and monitoring"
    echo "- IAM roles and policies"
    echo
    
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "Not available")
    ALB_DNS=$(terraform output -raw load_balancer_dns_name 2>/dev/null || echo "Not available")
    
    echo "=== Access Information ==="
    echo "Application URL: $APP_URL"
    echo "Load Balancer DNS: $ALB_DNS"
    echo "Health Check: $APP_URL/health"
    echo
    
    echo "=== Next Steps ==="
    echo "1. Test the application by visiting the Application URL"
    echo "2. Check the health endpoint to verify the application is running"
    echo "3. Monitor the Auto Scaling Group in the AWS Console"
    echo "4. View application logs in CloudWatch"
    echo
    
    cd ..
}

# Function to destroy infrastructure
destroy_infrastructure() {
    print_warning "This will destroy ALL infrastructure including:"
    print_warning "- All EC2 instances"
    print_warning "- Load balancer"
    print_warning "- VPC and networking"
    print_warning "- S3 buckets (and all data)"
    print_warning "- All other AWS resources"
    echo
    
    # Skip interactive prompt in CI/CD environments
    if [ "${CI}" = "true" ] || [ "${GITHUB_ACTIONS}" = "true" ] || [ "${NON_INTERACTIVE}" = "true" ]; then
        print_status "Running in CI/CD mode - auto-approving destruction"
    else
        read -p "Are you sure you want to destroy everything? Type 'yes' to confirm: " -r
        if [[ ! $REPLY == "yes" ]]; then
            print_status "Destruction cancelled"
            exit 0
        fi
    fi
    
    print_status "Destroying main infrastructure..."
    cd terraform
    terraform destroy -auto-approve
    cd ..
    
    print_status "Destroying bootstrap infrastructure..."
    cd terraform/bootstrap
    terraform destroy -auto-approve
    cd ../..
    
    print_success "All infrastructure destroyed"
}

# Main script logic
case "${1:-deploy}" in
    "bootstrap")
        check_prerequisites
        deploy_bootstrap
        ;;
    "deploy")
        check_prerequisites
        deploy_bootstrap
        deploy_main
        verify_deployment
        show_info
        ;;
    "main")
        check_prerequisites
        deploy_main
        verify_deployment
        show_info
        ;;
    "verify")
        verify_deployment
        ;;
    "info")
        show_info
        ;;
    "destroy")
        destroy_infrastructure
        ;;
    *)
        echo "Usage: $0 [bootstrap|deploy|main|verify|info|destroy]"
        echo
        echo "Commands:"
        echo "  bootstrap  - Deploy only the bootstrap infrastructure (S3 backend)"
        echo "  deploy     - Deploy complete infrastructure (bootstrap + main)"
        echo "  main       - Deploy only the main infrastructure (requires bootstrap)"
        echo "  verify     - Verify the deployment is working"
        echo "  info       - Show deployment information and outputs"
        echo "  destroy    - Destroy all infrastructure"
        echo
        echo "Default: deploy"
        exit 1
        ;;
esac