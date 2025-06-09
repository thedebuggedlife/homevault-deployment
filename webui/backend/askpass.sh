#!/bin/bash
# askpass helper to fetch credentials from the backend

# Get the nonce from environment variable
NONCE="${SUDO_NONCE:-}"

if [ -z "$NONCE" ]; then
    echo "Error: No nonce provided" >&2
    exit 1
fi

TIMEOUT_SEC=120

# Get the user who invoked sudo
FOR_USER="${SUDO_USER:-$(whoami)}"

# Collect sudo context information
SUDO_CONTEXT=$(cat <<EOF
{
    "nonce": "$NONCE",
    "username": "$FOR_USER",
    "timeoutSec": $TIMEOUT_SEC
}
EOF
)

# Make request to your backend service with all context
response=$(curl -s -X POST http://localhost:3001/api/activity/sudo \
    -H "Content-Type: application/json" \
    -d "$SUDO_CONTEXT" \
    --max-time "$TIMEOUT_SEC")

if [ $? -eq 0 ]; then
    echo "$response" | jq -r '.password'
else
    exit 1
fi