#!/bin/bash

PROJECT_ROOT="$( cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd )"

#shellcheck source=../../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../../lib/docker.sh
source "$PROJECT_ROOT/lib/docker.sh"

# Install the guests app
docker exec -it nextcloud_app ./occ app:install guests

# Give guests access to the Talk app
WHITELIST="$(docker exec -it nextcloud_app ./occ config:app:get guests whitelist)"
if [[ ",$WHITELIST," != *",spreed,"* ]]; then
    WHITELIST="${WHITELIST},spreed"
    docker exec -it nextcloud_app ./occ config:app:set guests whitelist --value="$WHITELIST"
fi

# Enable logging in using Nextcloud built-in login page
docker exec -it nextcloud_app ./occ config:app:set --value=1 user_oidc allow_multiple_user_backends

log_done