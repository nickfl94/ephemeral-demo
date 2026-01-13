#!/bin/bash
# Script to clean up duplicate DynamoDB lock entries
# This handles the case where multiple lock items exist with the same LockID

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
LOCK_ID="${BUCKET}/${KEY}"

echo -e "${BLUE}=== DynamoDB Lock Cleanup Tool ===${NC}"
echo "Bucket: $BUCKET"
echo "Key: $KEY"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo "Lock ID: $LOCK_ID"
echo "Region: $REGION"
echo ""

# Function to calculate MD5 checksum from S3
calculate_s3_checksum() {
    local temp_file="/tmp/terraform_state_$$"

    echo -e "${YELLOW}Downloading current state from S3...${NC}"
    if aws s3 cp "s3://${BUCKET}/${KEY}" "$temp_file" --region "$REGION" --quiet 2>/dev/null; then
        local checksum=$(md5sum "$temp_file" | awk '{print $1}')
        rm -f "$temp_file"
        echo -e "${GREEN}S3 Checksum: $checksum${NC}"
        echo "$checksum"
    else
        echo -e "${RED}ERROR: Failed to download state from S3${NC}"
        return 1
    fi
}

# Function to scan for all lock items
scan_all_locks() {
    echo -e "${YELLOW}Scanning DynamoDB table for all lock entries...${NC}" >&2

    local result=$(aws dynamodb scan \
        --table-name "$DYNAMODB_TABLE" \
        --region "$REGION" \
        --output json 2>&1)

    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to scan DynamoDB table${NC}" >&2
        echo "$result" >&2
        return 1
    fi

    # Validate JSON
    if ! echo "$result" | jq empty 2>/dev/null; then
        echo -e "${RED}ERROR: Invalid JSON response from DynamoDB${NC}" >&2
        echo "$result" >&2
        return 1
    fi

    echo "$result"
}

# Function to delete a specific lock item by its full key
delete_lock_by_digest() {
    local digest=$1

    echo -e "${YELLOW}Deleting lock entry with digest: $digest${NC}"

    # We need to scan for the item with this digest and get its full key
    local scan_result=$(aws dynamodb scan \
        --table-name "$DYNAMODB_TABLE" \
        --filter-expression "Digest = :digest" \
        --expression-attribute-values "{\":digest\":{\"S\":\"${digest}\"}}" \
        --region "$REGION" \
        --output json 2>/dev/null)

    local count=$(echo "$scan_result" | jq '.Items | length')

    if [ "$count" -gt 0 ]; then
        # Delete each matching item
        echo "$scan_result" | jq -c '.Items[]' | while read -r item; do
            local lock_id=$(echo "$item" | jq -r '.LockID.S')
            echo -e "${BLUE}Deleting item with LockID: $lock_id${NC}"

            aws dynamodb delete-item \
                --table-name "$DYNAMODB_TABLE" \
                --key "{\"LockID\": {\"S\": \"${lock_id}\"}}" \
                --region "$REGION" 2>/dev/null

            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ Deleted lock entry${NC}"
            else
                echo -e "${RED}✗ Failed to delete lock entry${NC}"
            fi
        done
    else
        echo -e "${YELLOW}No items found with digest: $digest${NC}"
    fi
}

# Function to delete ALL lock items for this state file
delete_all_locks() {
    echo -e "${YELLOW}Deleting ALL lock entries for ${LOCK_ID}...${NC}"

    # Scan for all items with this LockID pattern
    local scan_result=$(aws dynamodb scan \
        --table-name "$DYNAMODB_TABLE" \
        --region "$REGION" \
        --output json 2>/dev/null)

    local items=$(echo "$scan_result" | jq -c '.Items[] | select(.LockID.S | contains("'${BUCKET}'"))')

    if [ -z "$items" ]; then
        echo -e "${GREEN}No lock entries found${NC}"
        return 0
    fi

    echo "$items" | while read -r item; do
        local lock_id=$(echo "$item" | jq -r '.LockID.S')
        local digest=$(echo "$item" | jq -r '.Digest.S // "N/A"')

        echo -e "${BLUE}Deleting: LockID=$lock_id, Digest=$digest${NC}"

        aws dynamodb delete-item \
            --table-name "$DYNAMODB_TABLE" \
            --key "{\"LockID\": {\"S\": \"${lock_id}\"}}" \
            --region "$REGION" 2>/dev/null

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Deleted${NC}"
        else
            echo -e "${RED}✗ Failed to delete${NC}"
        fi
    done
}

# Main cleanup process
main() {
    echo -e "${BLUE}Step 1: Analyzing current state${NC}"
    echo ""

    # Get S3 checksum
    S3_CHECKSUM=$(calculate_s3_checksum)
    if [ $? -ne 0 ] || [ -z "$S3_CHECKSUM" ]; then
        echo -e "${RED}✗ Failed to get S3 checksum${NC}"
        exit 1
    fi
    echo ""

    # Scan for all locks
    echo -e "${BLUE}Step 2: Scanning DynamoDB for lock entries${NC}"
    ALL_LOCKS=$(scan_all_locks)
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to scan DynamoDB${NC}"
        exit 1
    fi

    # Check if we got valid JSON with Items
    if ! echo "$ALL_LOCKS" | jq -e '.Items' >/dev/null 2>&1; then
        echo -e "${RED}✗ Invalid response from DynamoDB (no Items array)${NC}"
        echo "Response: $ALL_LOCKS"
        exit 1
    fi

    # Filter for locks related to our state file (match both exact and with -md5 suffix)
    MATCHING_LOCKS=$(echo "$ALL_LOCKS" | jq -c '.Items[] | select(.LockID.S | test("'${BUCKET}'.*'${KEY}'"))' 2>/dev/null)

    # Count non-empty lines
    if [ -z "$MATCHING_LOCKS" ]; then
        LOCK_COUNT=0
    else
        LOCK_COUNT=$(echo "$MATCHING_LOCKS" | grep -c '^' || echo 0)
    fi

    echo -e "Found ${YELLOW}${LOCK_COUNT}${NC} lock entries for this state file"
    echo ""

    if [ "$LOCK_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✓ No lock entries found - state is clean${NC}"
        exit 0
    fi

    # Display all locks
    if [ "$LOCK_COUNT" -gt 0 ]; then
        echo -e "${BLUE}Current lock entries:${NC}"
        echo "$MATCHING_LOCKS" | while read -r lock; do
            if [ -n "$lock" ]; then
                local lock_id=$(echo "$lock" | jq -r '.LockID.S' 2>/dev/null || echo "unknown")
                local digest=$(echo "$lock" | jq -r '.Digest.S // "N/A"' 2>/dev/null || echo "N/A")

                if [ "$digest" = "$S3_CHECKSUM" ]; then
                    echo -e "  ${GREEN}✓ LockID: $lock_id${NC}"
                    echo -e "    Digest: $digest (matches S3)"
                else
                    echo -e "  ${RED}✗ LockID: $lock_id${NC}"
                    echo -e "    Digest: $digest (MISMATCH)"
                fi
            fi
        done
        echo ""
    fi

    # Decision: delete all locks
    echo -e "${BLUE}Step 3: Cleaning up duplicate locks${NC}"
    echo -e "${YELLOW}The safest approach is to delete ALL lock entries.${NC}"
    echo -e "${YELLOW}Terraform will recreate the correct lock on next operation.${NC}"
    echo ""

    # Delete all locks
    delete_all_locks
    echo ""

    echo -e "${GREEN}✓ Cleanup completed successfully!${NC}"
    echo -e "${BLUE}You can now run terraform commands again.${NC}"
    echo ""
    echo -e "${YELLOW}Note: If you continue to see duplicate locks, there may be:${NC}"
    echo "1. Concurrent Terraform operations running"
    echo "2. Multiple CI/CD jobs executing simultaneously"
    echo "3. A bug in the deployment workflow"
    echo ""
    echo "Check the workflow concurrency settings in:"
    echo "  .github/workflows/ephemeral-environments.yml"
}

# Run the main function
main
