#!/bin/bash
# Script to fix Terraform state checksum mismatches between S3 and DynamoDB
# This resolves the "state data in S3 does not have the expected content" error

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUCKET="${TERRAFORM_STATE_BUCKET:-enigma-global-ephemeral-terraform-state-2025}"
KEY="${TERRAFORM_STATE_KEY:-main/terraform.tfstate}"
DYNAMODB_TABLE="${TERRAFORM_STATE_TABLE:-enigma-global-ephemeral-terraform-locks}"
REGION="${AWS_REGION:-ap-southeast-2}"

echo -e "${BLUE}=== Terraform State Recovery Tool ===${NC}"
echo "Bucket: $BUCKET"
echo "Key: $KEY"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo "Region: $REGION"
echo ""

# Function to calculate MD5 checksum
calculate_s3_checksum() {
    local temp_file="/tmp/terraform_state_$$"

    echo -e "${YELLOW}Downloading current state from S3...${NC}" >&2
    if aws s3 cp "s3://${BUCKET}/${KEY}" "$temp_file" --region "$REGION" --quiet 2>&1 >/dev/null; then
        local checksum=$(md5sum "$temp_file" | awk '{print $1}')
        rm -f "$temp_file"
        echo "$checksum"
    else
        echo "ERROR: Failed to download state from S3" >&2
        return 1
    fi
}

# Function to get DynamoDB checksum
get_dynamodb_checksum() {
    echo -e "${YELLOW}Reading checksum from DynamoDB...${NC}" >&2
    local digest=$(aws dynamodb get-item \
        --table-name "$DYNAMODB_TABLE" \
        --key "{\"LockID\": {\"S\": \"${BUCKET}/${KEY}\"}}" \
        --query 'Item.Digest.S' \
        --output text \
        --region "$REGION" 2>/dev/null)

    if [ "$digest" != "None" ] && [ -n "$digest" ]; then
        echo "$digest"
    else
        echo "NONE"
    fi
}

# Function to update DynamoDB with correct checksum
update_dynamodb_checksum() {
    local new_checksum=$1

    echo -e "${YELLOW}Updating DynamoDB with correct checksum...${NC}" >&2

    # Use a JSON file to avoid shell escaping issues
    local json_file="/tmp/dynamodb_update_$$.json"
    cat > "$json_file" << EOF
{":checksum": {"S": "${new_checksum}"}}
EOF

    aws dynamodb update-item \
        --table-name "$DYNAMODB_TABLE" \
        --key "{\"LockID\": {\"S\": \"${BUCKET}/${KEY}\"}}" \
        --update-expression "SET Digest = :checksum" \
        --expression-attribute-values "file://${json_file}" \
        --region "$REGION" 2>&1 >/dev/null

    local result=$?
    rm -f "$json_file"

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✓ DynamoDB checksum updated successfully${NC}" >&2
        return 0
    else
        echo -e "${RED}✗ Failed to update DynamoDB checksum${NC}" >&2
        return 1
    fi
}

# Function to remove the lock item completely
remove_lock_item() {
    echo -e "${YELLOW}Removing lock item from DynamoDB...${NC}" >&2
    aws dynamodb delete-item \
        --table-name "$DYNAMODB_TABLE" \
        --key "{\"LockID\": {\"S\": \"${BUCKET}/${KEY}\"}}" \
        --region "$REGION" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Lock item removed${NC}" >&2
        return 0
    else
        echo -e "${YELLOW}Note: No lock item found (this is normal)${NC}" >&2
        return 0
    fi
}

# Main recovery process
main() {
    echo -e "${BLUE}Step 1: Checking current state${NC}" >&2

    # Calculate S3 checksum
    S3_CHECKSUM=$(calculate_s3_checksum)
    if [ $? -ne 0 ] || [ -z "$S3_CHECKSUM" ]; then
        echo -e "${RED}✗ Failed to calculate S3 checksum${NC}" >&2
        exit 1
    fi
    echo -e "${GREEN}S3 Checksum: $S3_CHECKSUM${NC}" >&2

    # Get DynamoDB checksum
    DYNAMODB_CHECKSUM=$(get_dynamodb_checksum)
    echo -e "DynamoDB Checksum: $DYNAMODB_CHECKSUM" >&2
    echo "" >&2

    if [ "$S3_CHECKSUM" = "$DYNAMODB_CHECKSUM" ]; then
        echo -e "${GREEN}✓ Checksums match! State is consistent.${NC}" >&2
        exit 0
    fi

    echo -e "${YELLOW}⚠ Checksums do not match!${NC}" >&2
    echo -e "${BLUE}Step 2: Fixing checksum mismatch${NC}" >&2

    # Remove any existing lock
    remove_lock_item
    echo "" >&2

    # Update DynamoDB with correct checksum
    if update_dynamodb_checksum "$S3_CHECKSUM"; then
        echo "" >&2
        echo -e "${GREEN}✓ State recovery completed successfully!${NC}" >&2
        echo -e "${BLUE}You can now run terraform commands again.${NC}" >&2
        exit 0
    else
        echo "" >&2
        echo -e "${RED}✗ Failed to fix state${NC}" >&2
        echo -e "${YELLOW}Manual intervention required:${NC}" >&2
        echo "1. Go to DynamoDB console" >&2
        echo "2. Open table: $DYNAMODB_TABLE" >&2
        echo "3. Find item with LockID: ${BUCKET}/${KEY}" >&2
        echo "4. Update Digest attribute to: $S3_CHECKSUM" >&2
        exit 1
    fi
}

# Run the main function
main
