#!/bin/bash

PROJECT_ROOT="$( cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd )"

#shellcheck source=../../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../../lib/docker.sh
source "$PROJECT_ROOT/lib/docker.sh"

# Uninstall the guests app
docker exec -it nextcloud_app ./occ app:disable guests

# Disable logging in using Nextcloud built-in login page
docker exec -it nextcloud_app ./occ config:app:set --value=0 user_oidc allow_multiple_user_backends

log_done