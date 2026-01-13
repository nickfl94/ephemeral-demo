#!/bin/bash
# Emergency script to force-sync Terraform state between S3 and DynamoDB
# Use this when multiple processes are causing constant state conflicts

set -e

BUCKET="${TERRAFORM_STATE_BUCKET:-enigma-global-ephemeral-terraform-state-2025}"
KEY="${TERRAFORM_STATE_KEY:-main/terraform.tfstate}"
DYNAMODB_TABLE="${TERRAFORM_STATE_TABLE:-enigma-global-ephemeral-terraform-locks}"
REGION="${AWS_REGION:-ap-southeast-2}"

echo "=== EMERGENCY STATE SYNC ==="
echo "This will:"
echo "1. Remove all locks from DynamoDB"
echo "2. Calculate current S3 checksum"
echo "3. Force update DynamoDB to match S3"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Step 1: Remove ALL lock items
echo "Step 1: Removing all locks..."
aws dynamodb delete-item \
    --table-name "$DYNAMODB_TABLE" \
    --key "{\"LockID\": {\"S\": \"${BUCKET}/${KEY}\"}}" \
    --region "$REGION" 2>/dev/null || echo "No lock found"

aws dynamodb delete-item \
    --table-name "$DYNAMODB_TABLE" \
    --key "{\"LockID\": {\"S\": \"${BUCKET}/${KEY}-md5\"}}" \
    --region "$REGION" 2>/dev/null || echo "No MD5 lock found"

echo "✓ Locks removed"

# Step 2: Wait for any in-flight operations
echo "Step 2: Waiting 5 seconds for in-flight operations..."
sleep 5

# Step 3: Download current state and calculate checksum
echo "Step 3: Calculating current S3 checksum..."
TEMP_FILE="/tmp/state_emergency_$$"
aws s3 cp "s3://${BUCKET}/${KEY}" "$TEMP_FILE" --region "$REGION" --quiet

if [ ! -f "$TEMP_FILE" ]; then
    echo "ERROR: Failed to download state file"
    exit 1
fi

CHECKSUM=$(md5sum "$TEMP_FILE" | awk '{print $1}')
rm -f "$TEMP_FILE"

echo "Current S3 checksum: $CHECKSUM"

# Step 4: Force create/update the DynamoDB item with correct checksum
echo "Step 4: Force updating DynamoDB..."

# Create JSON for attribute values
JSON_FILE="/tmp/dynamodb_emergency_$$.json"
cat > "$JSON_FILE" << EOF
{
  "LockID": {"S": "${BUCKET}/${KEY}"},
  "Digest": {"S": "${CHECKSUM}"}
}
EOF

# Use put-item to force create/update
aws dynamodb put-item \
    --table-name "$DYNAMODB_TABLE" \
    --item "file://${JSON_FILE}" \
    --region "$REGION"

rm -f "$JSON_FILE"

echo "✓ DynamoDB updated with checksum: $CHECKSUM"
echo ""
echo "=== STATE SYNC COMPLETE ==="
echo "You can now run Terraform commands"
