#!/bin/bash
# Script to cancel all running GitHub Actions workflows

set -e

# Get repository info from git
REPO_URL=$(git config --get remote.origin.url)
REPO=$(echo "$REPO_URL" | sed -E 's/.*[:/]([^/]+\/[^/]+)(\.git)?$/\1/')

echo "=== GitHub Workflows Cancellation ==="
echo "Repository: $REPO"
echo ""

# List running workflows
echo "Fetching running workflows..."
RUNNING_WORKFLOWS=$(gh run list --repo "$REPO" --status in_progress --json databaseId,name,status,createdAt --limit 50)

if [ "$(echo "$RUNNING_WORKFLOWS" | jq '. | length')" -eq 0 ]; then
    echo "✓ No running workflows found"
    exit 0
fi

echo "Running workflows:"
echo "$RUNNING_WORKFLOWS" | jq -r '.[] | "  - ID: \(.databaseId) | \(.name) | Started: \(.createdAt)"'
echo ""

read -p "Cancel all these workflows? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Cancel each workflow
echo "Cancelling workflows..."
echo "$RUNNING_WORKFLOWS" | jq -r '.[].databaseId' | while read -r RUN_ID; do
    echo "  Cancelling workflow $RUN_ID..."
    gh run cancel "$RUN_ID" --repo "$REPO" || echo "    Failed to cancel $RUN_ID"
done

echo ""
echo "✓ All workflows cancelled"
echo ""
echo "Next steps:"
echo "1. Wait 30 seconds for workflows to fully stop"
echo "2. Run: ./scripts/emergency-state-sync.sh (if not in GitHub Actions)"
echo "3. Push your changes with concurrency control"
echo "4. New workflows will queue properly"
