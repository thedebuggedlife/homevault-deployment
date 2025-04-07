#!/bin/bash

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
    --mapping-display-name="name" \
    --mapping-quota="nextcloud_quota"
# Disable other forms of login to the server
./occ config:app:set --value=0 user_oidc allow_multiple_user_backends