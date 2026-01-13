#!/bin/bash
# Script to cancel all running GitHub Actions workflows using GitHub API
# Requires: GITHUB_TOKEN environment variable

set -e

# Get repository info from git
REPO_URL=$(git config --get remote.origin.url)
REPO=$(echo "$REPO_URL" | sed -E 's/.*[:/]([^/]+\/[^/]+)(\.git)?$/\1/')

if [ -z "$GITHUB_TOKEN" ]; then
    echo "ERROR: GITHUB_TOKEN environment variable is not set"
    echo ""
    echo "To set it:"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Generate a new token with 'repo' and 'workflow' scopes"
    echo "3. Export it: export GITHUB_TOKEN=your_token_here"
    echo ""
    echo "Or manually cancel workflows at:"
    echo "https://github.com/$REPO/actions"
    exit 1
fi

echo "=== GitHub Workflows Cancellation (API) ==="
echo "Repository: $REPO"
echo ""

# List running workflows
echo "Fetching running workflows..."
RESPONSE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO/actions/runs?status=in_progress&per_page=50")

# Check if we got an error
if echo "$RESPONSE" | grep -q "Bad credentials"; then
    echo "ERROR: Invalid GitHub token"
    exit 1
fi

RUN_IDS=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -20 | cut -d: -f2)
RUN_COUNT=$(echo "$RUN_IDS" | grep -c . || echo "0")

if [ "$RUN_COUNT" -eq 0 ]; then
    echo "✓ No running workflows found"
    exit 0
fi

echo "Found $RUN_COUNT running workflow(s)"
echo "$RESPONSE" | grep -o '"name":"[^"]*"' | head -20 | cut -d'"' -f4 | while read -r name; do
    echo "  - $name"
done
echo ""

read -p "Cancel all these workflows? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Cancel each workflow
echo "Cancelling workflows..."
echo "$RUN_IDS" | while read -r RUN_ID; do
    if [ -n "$RUN_ID" ]; then
        echo "  Cancelling workflow $RUN_ID..."
        curl -s -X POST \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/cancel" > /dev/null
    fi
done

echo ""
echo "✓ All workflows cancelled"
echo ""
echo "Next steps:"
echo "1. Wait 30 seconds for workflows to fully stop"
echo "2. Commit and push your changes"
echo "3. New workflows will queue properly with concurrency control"
