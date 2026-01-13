#!/bin/bash
# Simple diagnostic script to check DynamoDB access

set -e

DYNAMODB_TABLE="${TERRAFORM_STATE_TABLE:-enigma-global-ephemeral-terraform-locks}"
REGION="${AWS_REGION:-ap-southeast-2}"

echo "=== DynamoDB Diagnostic Tool ==="
echo "Table: $DYNAMODB_TABLE"
echo "Region: $REGION"
echo ""

echo "Current AWS Identity:"
aws sts get-caller-identity
echo ""

echo "Attempting to describe table..."
aws dynamodb describe-table \
    --table-name "$DYNAMODB_TABLE" \
    --region "$REGION" \
    2>&1 | head -30
echo ""

echo "Attempting to scan table..."
aws dynamodb scan \
    --table-name "$DYNAMODB_TABLE" \
    --region "$REGION" \
    --max-items 5 \
    2>&1
