#!/bin/bash

echo "INITIALIZING NEXTCLOUD OFFICE"

./occ app:install richdocuments

./occ config:app:set --value "https://${COLLABORA_SERVER_NAME}" richdocuments wopi_url

./occ richdocuments:activate-config