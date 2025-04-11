#!/bin/bash
set -e

# Get the status from the Nextcloud status endpoint
STATUS_OUTPUT=$(curl -fsSL http://localhost/status.php)

# Check if curl command succeeded
if [ $? -ne 0 ]; then
    echo "Failed to reach Nextcloud status endpoint"
    exit 1
fi

# Check if "installed":true is in the response
if echo "$STATUS_OUTPUT" | grep -q '"installed":true'; then
    echo "Nextcloud is installed and ready"
    exit 0
else
    echo "Nextcloud installation is not complete"
    exit 1
fi