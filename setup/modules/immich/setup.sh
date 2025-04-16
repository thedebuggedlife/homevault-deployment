if [ -n "$__SETUP_IMMICH" ]; then return 0; fi

__SETUP_IMMICH=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/http.sh
source "$PROJECT_ROOT/lib/http.sh"

IMMICH_BASE_URL=http://localhost:2283
IMMICH_TOKEN=

################################################################################
#                              IMMICH API CLIENT

immich_rest_call() {
    local response auth_header
    if [ -n "$IMMICH_API_KEY" ]; then
        auth_header="x-api-key: $IMMICH_API_KEY"
    elif [ -n "$IMMICH_TOKEN" ]; then
        auth_header="Authorization: Bearer $IMMICH_TOKEN"
    fi
    if ! response=$(rest_call "$1" "$IMMICH_BASE_URL/api/$2" -h "$auth_header" -b "$3" -c "immich_server"); then
        return 1
    fi
    echo "$response"
}

###
# Creates the initial administrator account
#
# Parameters:
#   $1 {string} Email
#   $2 {string} Password
#   $3 {string} Display name
#
# Return: {void}
###
immich_admin_sign_up() {
    local body
    body=$(jq -n -c --arg email "$1" --arg password "$2" --arg name "$3" '{"email": $email, "password": $password, "name": $name}')
    immich_rest_call POST auth/admin-sign-up "$body" > /dev/null || return 1
}

###
# Logs the specified user into Immich
#
# Parameters:
#   $1 {string} Email
#   $2 {string} Password
#
# Return:
#   {json} The details of the signed in user. See: https://immich.app/docs/api/login
###
immich_login() {
    local body
    body=$(jq -n -c --arg email "$1" --arg password "$2" '{"email": $email, "password": $password}')
    immich_rest_call POST auth/login "$body" || return 1
}

###
# Logs out the currently signed in user
#
# Return: {void}
###
immich_logout() {
    immich_rest_call POST auth/logout > /dev/null || return 1
}

###
# Creates an API key for Immich with the given permissions
#
# Parameters:
#   $1 {string} Name of the API key
#   $@ {string} Permissions to grant (default="all")
#
# Return:
#   {string} The API Key
###
immich_create_api_key() {
    local name=$1
    shift
    local permissions=("$@")
    if [ ${#permissions[@]} -eq 0 ]; then permissions=("all"); fi
    local body
    if ! body=$(jq -n -c --arg name "$name" --args '{"name": $name, "permissions":$ARGS.positional}' "${permissions[@]}"); then
        log_error "immich_create_api_key: Failed to format JSON for request"
        return 1
    fi
    immich_rest_call POST api-keys "$body" | jq -r '.secret' || return 1
}

###
# Gets the configuration of the server. Does not require authentication.
#
# Return:
#   {json} The server configuration object. See: https://immich.app/docs/api/get-server-config
###
immich_get_server_config() {
    immich_rest_call GET server/config || return 1
}

immich_get_system_config() {
    local response
    if ! response=$(immich_rest_call GET system-config); then
        return 1
    fi
    if ! echo "$response" | jq empty > /dev/null 2>&1; then
        log_error "Immich API did not return valid JSON"
        log_error "$response"
    fi
    echo "$response"
}

immich_update_system_config() {
    immich_rest_call PUT system-config "$1" || return 1
}

################################################################################
#                            IMMICH CONFIGURATION

immich_configure_admin_account() {
    local is_onboarded
    if ! is_onboarded=$(immich_get_server_config | jq -r '.isInitialized'); then return 1; fi
    if [ "$is_onboarded" = true ]; then
        echo "Immich administrator account is already onboarded."
        return 0
    fi
    echo "Onboarding Immich administrator account..."
    immich_admin_sign_up "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_DISPLAY_NAME" > /dev/null || return 1
    echo -e "Administrator account ${Purple}$ADMIN_EMAIL${COff} has been onboarded to Immich"
}

immich_configure_api_key() {
    if [ -n "$IMMICH_API_KEY" ]; then
        echo "Immich API Key is already configured."
        return 0
    fi
    echo "Logging in administrator account..."
    if ! IMMICH_TOKEN=$(immich_login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" | jq -r '.accessToken'); then
        log_error "Failed to sign user '$ADMIN_EMAIL' to Immich."
        return 1
    fi
    echo "Creating new API Key..."
    local api_key
    if ! api_key=$(immich_create_api_key "Selfhost" "systemConfig.read" "systemConfig.update"); then return 1; fi
    echo "Logging out administrator account..."
    immich_logout
    save_env IMMICH_API_KEY "$api_key"
}

immich_configure_oauth() {
    echo "Fetching current Immich server configuration..."
    
    local immich_config client_secret
    if ! immich_config=$(immich_get_system_config); then
        return 1
    fi

    if ! client_secret=$(<"${SECRETS_PATH}oidc_immich_password"); then
        log_error "Failed to read OIDC password from '${SECRETS_PATH}oidc_immich_password'"
        return 1
    fi

    if ! immich_config=$(echo "$immich_config" | jq -c \
        --arg clientId "$OIDC_IMMICH_CLIENT_ID" \
        --arg clientSecret "$client_secret" \
        --argjson storageQuota "$IMMICH_DEFAULT_QUOTA" \
        --arg externalDomain "https://${IMMICH_SUBDOMAIN}.${CF_DOMAIN_NAME}" \
        --arg smtpFrom "${SMTP_SENDER}@${CF_DOMAIN_NAME}" \
        --arg smtpServer "$SMTP_SERVER" \
        --argjson smtpPort "$SMTP_PORT" \
        --arg smtpUsername "$SMTP_USERNAME" \
        --arg smtpPassword "$SMTP_PASSWORD" \
        --arg issuerUrl "https://authelia.${CF_DOMAIN_NAME}/.well-known/openid-configuration" '
        .oauth.enabled = true |
        .oauth.autoLaunch = true |
        .oauth.autoRegister = true |
        .oauth.buttonText = "Login" |
        .oauth.storageLabelClaim = "preferred_username" |
        .oauth.storageQuotaClaim = "immich_quota" |
        .oauth.clientId = $clientId |
        .oauth.clientSecret = $clientSecret |
        .oauth.defaultStorageQuota = $storageQuota |
        .oauth.issuerUrl = $issuerUrl |
        .passwordLogin.enabled = false |
        .server.externalDomain = $externalDomain |
        .notifications.smtp.enabled = true |
        .notifications.smtp.from = $smtpFrom |
        .notifications.smtp.transport.host = $smtpServer |
        .notifications.smtp.transport.port = $smtpPort |
        .notifications.smtp.transport.username = $smtpUsername |
        .notifications.smtp.transport.password = $smtpPassword
    '); then
        log_error "Failed to generate Immich config json"
        return 1
    fi

    echo "Saving updated Immich server configuration..."

    immich_update_system_config "$immich_config" >/dev/null || return 1
}

################################################################################
#                          IMMICH SETUP HOOKS

immich_config_env() {
    ask_for_env IMMICH_VERSION "Version of Immich to install"
    ask_for_env IMMICH_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Immich"
    ask_for_env IMMICH_UPLOAD_LOCATION "Immich photo upload location"
    ask_for_env IMMICH_DEFAULT_QUOTA "Immich default user storage quota (in GB)"
}

immich_config_secrets() {
    save_env_id OIDC_IMMICH_CLIENT_ID
    create_secret "${SECRETS_PATH}immich_db_password"
    create_password_digest_pair "${SECRETS_PATH}oidc_immich"
}

immich_pre_install() {
    ensure_path_exists "$IMMICH_UPLOAD_LOCATION" || return 1
}

immich_post_install() {
    log_header "Configuring Immich"

    immich_configure_admin_account || return 1
    immich_configure_api_key || return 1
    immich_configure_oauth || return 1
}

CONFIG_ENV_HOOKS+=("immich_config_env")
CONFIG_SECRETS_HOOKS+=("immich_config_secrets")
PRE_INSTALL_HOOKS+=("immich_pre_install")
POST_INSTALL_HOOKS+=("immich_post_install")
# BOOTSTRAP_HOOKS+=("immich_bootstrap")