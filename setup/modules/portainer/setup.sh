#!/bin/bash

if [ -n "$__SETUP_PORTAINER" ]; then return 0; fi

__SETUP_PORTAINER=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/http.sh
source "$PROJECT_ROOT/lib/http.sh"

## Internal variables

PORTAINER_BASE_URL=http://localhost:9000/api
PORTAINER_TOKEN=

## Variables from .env

OIDC_PORTAINER_CLIENT_ID=
PORTAINER_SUBDOMAIN=
PORTAINER_API_KEY=


################################################################################
#                           PORTAINER API CLIENT

# See: https://app.swaggerhub.com/apis/portainer/portainer-ce/2.27.3

###
# Make a REST call to portainer via docker
###
portainer_rest_call() {
    local method=$1
    local url_path=$2
    shift 2
    local response auth_header
    if [ -n "$PORTAINER_API_KEY" ]; then
        auth_header="X-API-Key: $PORTAINER_API_KEY"
    elif [ -n "$PORTAINER_TOKEN" ]; then
        auth_header="Authorization: Bearer $PORTAINER_TOKEN"
    fi
    if ! response=$(rest_call "$method" "$PORTAINER_BASE_URL/$url_path" -h "$auth_header" -c "portainer" "$@"); then
        return 1
    fi
    echo "$response"
}

###
# Check if an administrator account already exists
#
# @param $1 {boolean} If 'false', do not attempt to restart container [default=true]
# @return   {boolean} 'true' if admin account exists, 'false' if it doesn't
###
portainer_admin_check() {
    local allow_restart=${1:-true}
    local status_code
    if ! status_code=$(portainer_rest_call GET users/admin/check -s); then return 1; fi
    if [ "$status_code" = "204" ]; then
        echo "true"
    elif [ "$status_code" = "404" ]; then
        echo "false"
    elif [[ "$status_code" = "303" && "$allow_restart" = true ]]; then
        # Administrator initialization window has closed, try restarting Portainer
        echo "Portainer AdminInitTimeout expired. Attempting to restart container..." >&2
        sg docker -c "docker restart portainer"
        sleep 5
        portainer_admin_check false
    else
        log_error "Unexpected status code returned from GET $PORTAINER_BASE_URL/users/admin/check: $status_code"
        return 1
    fi
}

###
# Initialize the administrator account
#
# @param $1 {string} The username for the account
# @param $2 {string} The password for the account
###
portainer_admin_init() {
    local body
    body=$(jq -n -c --arg username "$1" --arg password "$2" '{"username":$username,"password":$password}')
    portainer_rest_call POST users/admin/init -b "$body" > /dev/null
}

###
# Log a user in
#
# @param $1 {string} The username to log in
# @param $2 {string} The password for the user
# @return   {string} The JWT token for the user
###
portainer_login() {
    local body response token
    body=$(jq -n -c --arg username "$1" --arg password "$2" '{"username":$username,"password":$password}')
    if ! response=$(portainer_rest_call POST auth -b "$body"); then return 1; fi
    if ! token=$(echo "$response" | jq -r '.jwt') || [ -z "$token" ]; then
        log_error "Could not extract JWT token from response: '$response'"
        return 1
    fi
    echo "$token"
}

###
# Retrieve the ID of the current logged in user
#
# @return   {string} The ID for the user
###
portainer_get_current_user_id() {
    local response user_id
    if ! response=$(portainer_rest_call GET users/me); then return 1; fi
    if ! user_id=$(echo "$response" | jq -r '.Id') || [ -z "$user_id" ]; then
        log_error "Could not extract the user ID from response: '$response'"
        return 1
    fi
    echo "$user_id"
}

###
# Log out a user
###
portainer_logout() {
    portainer_rest_call POST auth/logout -s >/dev/null
}

###
# Create a new API key
#
# @param $1 {string} Description for the API key
# @param $2 {string} User ID that owns the API key
# @param $3 {string} Password for the user (for internal validation)
# @return   {string} The created API key
###
portainer_create_api_key() {
    local body response api_key
    body=$(jq -n -c --arg description "$1" --arg password "$3" '{"description":$description,"password":$password}')
    if ! response=$(portainer_rest_call POST "users/$2/tokens" -b "$body"); then return 1; fi
    if ! api_key=$(echo "$response" | jq -r '.rawAPIKey') || [ -z "$api_key" ]; then
        log_error "Could not extract the API key from response: '$response'"
        return 1
    fi
    echo "$api_key"
}

###
# Retrieve the server settings
#
# @return   {json} The server settings object returned by the API
###
portainer_get_settings() {
    portainer_rest_call GET settings
}

###
# Store the server settings
#
# @param $1 {json} The server settings object
###
portainer_set_settings() {
    portainer_rest_call PUT settings -b "$1" > /dev/null
}

################################################################################
#                            COCKPIT CONFIGURATION

portainer_configure_admin_account() {
    local has_admin
    if ! has_admin=$(portainer_admin_check); then return 1; fi
    if [ "$has_admin" = true ]; then
        echo "The administrator account has been onboarded previously."
        return 0
    fi
    local portainer_password
    if ! portainer_password=$(<"${SECRETS_PATH}portainer_admin_password"); then
        log_error "Could not read admin password from '${SECRETS_PATH}portainer_admin_password'"
        return 1
    fi
    echo "Onboarding Portainer administrator account..."
    portainer_admin_init "$ADMIN_USERNAME" "$portainer_password" || return 1
    echo -e "Administrator account ${Purple}$ADMIN_USERNAME${COff} has been onboarded to Immich"
}

portainer_configure_api_key() {
    if [ -n "$PORTAINER_API_KEY" ]; then
        echo "Portainer API Key is already configured."
        return 0
    fi
    echo "Logging in administrator account..."
    local portainer_password
    if ! portainer_password=$(<"${SECRETS_PATH}portainer_admin_password"); then
        log_error "Could not read admin password from '${SECRETS_PATH}portainer_admin_password'"
        return 1
    fi
    if ! PORTAINER_TOKEN=$(portainer_login "$ADMIN_USERNAME" "$portainer_password"); then
        log_error "Failed to sign user '$ADMIN_USERNAME' to Immich."
        return 1
    fi
    echo "Getting user id..."
    local user_id
    if ! user_id=$(portainer_get_current_user_id); then return 1; fi
    echo "Creating new API Key..."
    local api_key
    if ! api_key=$(portainer_create_api_key "Selfhost" "$user_id" "$portainer_password"); then return 1; fi
    echo "Logging out administrator account..."
    portainer_logout
    save_env PORTAINER_API_KEY "$api_key"
}

portainer_configure_oauth() {
    echo "Getting current server configuration..."

    local settings
    if ! settings=$(portainer_get_settings); then return 1; fi

    if ! client_secret=$(< "${SECRETS_PATH}/oidc_portainer_password"); then
        log_error "Failed to read OIDC password from '${SECRETS_PATH}/oidc_portainer_password'"
        return 1
    fi

    if ! settings=$(echo "$settings" | jq -c \
        --arg clientId "$OIDC_PORTAINER_CLIENT_ID" \
        --arg clientSecret "$client_secret" \
        --arg baseDN "$CF_DOMAIN_NAME" \
        --arg portainerDN "$PORTAINER_SUBDOMAIN" '
        .OAuthSettings.ClientID = $clientId |
        .OAuthSettings.ClientSecret = $clientSecret |
        .OAuthSettings.AccessTokenURI = "https://authelia.\($baseDN)/api/oidc/token" |
        .OAuthSettings.AuthorizationURI = "https://authelia.\($baseDN)/api/oidc/authorization"|
        .OAuthSettings.ResourceURI = "https://authelia.\($baseDN)/api/oidc/userinfo" |
        .OAuthSettings.RedirectURI = "https://\($portainerDN).\($baseDN)" |
        .OAuthSettings.UserIdentifier = "preferred_username" |
        .OAuthSettings.Scopes = "openid profile groups email" |
        .OAuthSettings.OAuthAutoCreateUsers = false |
        .OAuthSettings.DefaultTeamID = 0 |
        .OAuthSettings.SSO = true |
        .OAuthSettings.LogoutURI = "" |
        .OAuthSettings.AuthStyle = 1 |
        .AuthenticationMethod = 3
    '); then
        log_error "Failed to generate configuration object"
        return 1
    fi

    echo "Saving updated server configuration..."

    portainer_set_settings "$settings" || return 1
}

################################################################################
#                          PORTAINER SETUP HOOKS

portainer_config_env() {
    ask_for_env PORTAINER_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Portainer"
}

portainer_config_secrets() {
    save_env_id OIDC_PORTAINER_CLIENT_ID
    create_secret "${SECRETS_PATH}portainer_admin_password"
    create_password_digest_pair "${SECRETS_PATH}oidc_portainer"
}

portainer_post_install() {
    log_header "Configuring Portainer"

    portainer_configure_admin_account || return 1
    portainer_configure_api_key || return 1
    portainer_configure_oauth || return 1
}

CONFIG_ENV_HOOKS+=("portainer_config_env")
CONFIG_SECRETS_HOOKS+=("portainer_config_secrets")
# PRE_INSTALL_HOOKS+=("")
POST_INSTALL_HOOKS+=("portainer_post_install")
# BOOTSTRAP_HOOKS+=("")