if [ -n "$__SETUP_IMMICH" ]; then return 0; fi

__SETUP_IMMICH=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/http.sh
source "$PROJECT_ROOT/lib/http.sh"

IMMICH_BASE_URL=

################################################################################
#                              IMMICH API CLIENT

immich_rest_call() {
    if [[ -z "$IMMICH_BASE_URL" || -z "$IMMICH_API_KEY" ]]; then
        log_error "Base settings to call Immich have not been set."
        return 1
    fi
    local response
    if ! response=$(rest_call $1 "$IMMICH_BASE_URL/api/$2" "x-api-key: $IMMICH_API_KEY" "$3"); then
        return 1
    fi
    echo "$response"
}

immich_get_config() {
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

immich_update_config() {
    immich_rest_call PUT system-config "$1"
    if [ $? -ne 0 ]; then
        return 1
    fi
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
    ensure_path_exists "$IMMICH_UPLOAD_LOCATION"
}

immich_bootstrap() {
    log_header "Bootstrapping Immich"

    if [[ -z "$CF_DOMAIN_NAME" || \
          -z "$OIDC_IMMICH_CLIENT_ID" || \
          -z "$SMTP_SENDER" || \
          -z "$SMTP_SERVER" || \
          -z "$SMTP_PORT" || \
          -z "$SMTP_USERNAME" || \
          -z "$SMTP_PASSWORD" || \
          -z "$SMTP_PASSWORD" || \
          ! -s "${SECRETS_PATH}oidc_immich_password" ]]; then
        log_error "Missing values in .env file. Make sure to deploy project before running bootstrap."
        return 1
    fi

    IMMICH_BASE_URL="https://${IMMICH_SUBDOMAIN}.${CF_DOMAIN_NAME}"

    if [[ -z "$IMMICH_API_KEY" || "$RESUME" != "true" ]]; then

        echo -e "\nYour Immich server address is: ${UCyan}${IMMICH_BASE_URL}${COff}"
        echo -e "\nTo get an API Key, sign in and go to ${Purple}Account Settings${COff} and look for ${Purple}API Keys${COff}."
        echo -e "\n${UYellow}You MUST use the same username and password provided for the server administrator.${COff}\n"

        ask_for_env IMMICH_API_KEY "API Key for Immich" || return 1
    fi

    echo "Fetching current Immich server configuration..."
    
    local immich_config client_secret
    if ! immich_config=$(immich_get_config); then
        return 1
    fi

    if ! client_secret=$(<"${SECRETS_PATH}oidc_immich_password"); then
        log_error "Failed to read OIDC password from '${SECRETS_PATH}oidc_immich_password'"
        return 1
    fi

    if ! immich_config=$(echo "$immich_config" | jq \
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

    immich_update_config "$immich_config" >/dev/null
    if [ $? -ne 0 ]; then
        return 1
    fi
}

CONFIG_ENV_HOOKS+=("immich_config_env")
CONFIG_SECRETS_HOOKS+=("immich_config_secrets")
PRE_INSTALL_HOOKS+=("immich_pre_install")
# POST_INSTALL_HOOKS+=(...)
BOOTSTRAP_HOOKS+=("immich_bootstrap")