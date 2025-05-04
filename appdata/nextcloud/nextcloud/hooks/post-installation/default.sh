#!/bin/bash

# Use cron to run background jobs
./occ background:cron

echo "INITIALIZING OIDC"

# Load the client secret from file
client_secret=$(<"/run/secrets/oidc_nextcloud_password")
# Install the OpenID Connect user backend for Nextcloud
./occ app:install user_oidc
# Add an OIDC provider for Authelia
./occ user_oidc:provider authelia \
    --clientid="$OIDC_NEXTCLOUD_CLIENT_ID" \
    --clientsecret="$client_secret" \
    --discoveryuri="https://authelia.${CF_DOMAIN_NAME}/.well-known/openid-configuration" \
    --endsessionendpointuri="https://authelia.${CF_DOMAIN_NAME}/logout" \
    --mapping-uid="preferred_username" \
    --mapping-display-name="name"
# Disable other forms of login to the server
./occ config:app:set --value=0 user_oidc allow_multiple_user_backends

echo "FINISHED INITIALIZING OIDC"

echo "SETTING UP DEFAULT QUOTA"

./occ config:app:set files default_quota --value "${NEXTCLOUD_DEFAULT_QUOTA} GB"

echo "FINISHED SETTING UP DEFAULT QUOTA"

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

echo "INSTALLING NEXTCLOUD TALK"

./occ app:install spreed

echo "FINISHED INSTALLING NEXTCLOUD TALK"

echo "INITIALIZING NEXTCLOUD FULL TEXT SEARCH"

if ! elastic_password=$(<"$ELASTIC_SEARCH_PASSWORD_FILE"); then
    echo "Failed to read elastic search password from '$ELASTIC_SEARCH_PASSWORD_FILE'"
fi

./occ app:install fulltextsearch
./occ app:install fulltextsearch_elasticsearch
./occ app:install files_fulltextsearch

./occ config:app:set fulltextsearch app_navigation --value="1"
./occ config:app:set fulltextsearch enabled --value="yes"
./occ config:app:set fulltextsearch search_platform --value="OCA\FullTextSearch_Elasticsearch\Platform\ElasticSearchPlatform"

./occ config:app:set fulltextsearch_elasticsearch analyzer_tokenizer --value="standard"
./occ config:app:set fulltextsearch_elasticsearch elastic_host --value="http://$ELASTIC_SEARCH_USER:$elastic_password@$ELASTIC_SEARCH_HOST:9200"
./occ config:app:set fulltextsearch_elasticsearch elastic_index --value="$ELASTIC_SEARCH_INDEX"
./occ config:app:set fulltextsearch_elasticsearch enabled --value="yes"

./occ config:app:set files_fulltextsearch enabled --value="yes"
./occ config:app:set files_fulltextsearch files_local --value="1"
./occ config:app:set files_fulltextsearch files_office --value="1"
./occ config:app:set files_fulltextsearch files_open_result_directly --value="1"
./occ config:app:set files_fulltextsearch files_pdf --value="1"
./occ config:app:set files_fulltextsearch files_size --value="20"

./occ --quiet fulltextsearch:index

echo "FINISHED INITIALIZING FULL TEXT SEARCH"

echo "INITIALIZING SERVER TOKEN"

TOKEN=$(< /run/secrets/nextcloud_server_token)

./occ config:app:set serverinfo token --value "${TOKEN}"

echo "FINISHED INITIALIZING SERVER TOKEN"