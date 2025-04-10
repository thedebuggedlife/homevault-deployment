#!/bin/bash

echo "INITIALIZING NEXTCLOUD OFFICE"

./occ app:install richdocuments

./occ config:app:set --value "https://${COLLABORA_SERVER_NAME}" richdocuments wopi_url

echo "Waiting for Collabora server to be ready..."
while true; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "https://${COLLABORA_SERVER_NAME}" 2>/dev/null)
  if [ "$response" = "200" ]; then
    body=$(curl -s "https://${COLLABORA_SERVER_NAME}")
    if [[ "$body" == *"OK"* ]]; then
      echo "Collabora server is ready!"
      break
    fi
  fi
  echo "Collabora server not ready yet, waiting 15 seconds..."
  sleep 15
done

./occ richdocuments:activate-config

echo "FINISHED INITIALIZING NEXTCLOUD OFFICE"