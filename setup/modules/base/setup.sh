if [ -n "$__SETUP_BASE" ]; then return 0; fi

__SETUP_BASE=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/tailscale.sh
source "$PROJECT_ROOT/lib/tailscale.sh"
#shellcheck source=../../lib/cloudflare.sh
source "$PROJECT_ROOT/lib/cloudflare.sh"

###
# Create dynamic configuration files for enabled modules
#
# @return: {void}
###
configure_traefik() {
    local source_dir="${APPDATA_LOCATION%/}/traefik"
    local dest_dir="${APPDATA_LOCATION%/}/traefik/dynamic"

    ensure_path_exists "$dest_dir"

    # First, delete any existing module configs
    if ls "${dest_dir}"/dynamic-*.yml 1> /dev/null 2>&1; then
        rm "${dest_dir}"/dynamic-*.yml
    fi
    # Next, copy the dynamic config for enabled modules
    for module in "${ENABLED_MODULES[@]}"; do
        src_file="${source_dir}/dynamic-${module}.yml"
        dest_file="${dest_dir}/dynamic-${module}.yml"
        if [[ -f "$src_file" ]]; then
            cp "$src_file" "$dest_file"
            echo -e "Copied dynamic Traefik configuration for ${Purple}$module${COff}"
        fi
    done
}

###
# Find all applicable authelia configuration files
#
# @return {void}
###
configure_authelia() {
    local -a file_list=()
    for module in "${ENABLED_MODULES[@]}"; do
        local config_file="${APPDATA_LOCATION%/}/authelia/configuration-${module}.yml"
        if [[ -f "$config_file" ]]; then
            file_list+=("configuration-${module}.yml")
        fi
    done
    local configuration
    # shellcheck disable=SC2016
    local expr='
        (.identity_providers.oidc.clients as $item ireduce ([]; . + $item )) as $clients | 
        (.identity_providers.oidc.authorization_policies as $item ireduce ({}; . * $item )) as $policies |
        [select(fileIndex == 0) * {"identity_providers":{"oidc":{"authorization_policies":$policies,"clients":$clients}}}] |
        .[0]'
    local docker_cmd="docker run -q --rm -it -v '${APPDATA_LOCATION%/}/authelia':/workdir mikefarah/yq:4.45.1 -M ea '$expr' ${file_list[*]}"
    if ! configuration=$(sg docker -c "$docker_cmd"); then
        log_error "Failed to merge Authelia configuration"
        exit 1
    fi
    echo "$configuration" | sed 's/'\''{{/{{/g; s/}}'\''/}}/g' | sudo tee "${APPDATA_LOCATION%/}/authelia/configuration.yml" > /dev/null || {
        log_error "Failed to write Authelia configuration"
        exit 1
    }
}

###
# Create the users and groups needed to run the applications
#
# @return void
###
lldap_bootstrap() {
    if [[ ! -s "${SECRETS_PATH}ldap_authelia_password" ]]; then
        log_error "Missing secret files."
        exit 1
    fi

    # Paste the generated secret for Authelia's LLDAP password into the bootstrap user file
    local authelia_password authelia_file authelia_json
    authelia_password=$(<"${SECRETS_PATH}ldap_authelia_password")
    authelia_file="${APPDATA_LOCATION%/}/lldap/bootstrap/user-configs/authelia.json"
    authelia_json=$(jq --arg password "$authelia_password" '.password = $password' "$authelia_file")
    echo "$authelia_json" > "$authelia_file" || {
        log_error "Failed to write file '$authelia_file'"
        exit 1
    }

    echo -e "Starting LLDAP service...\n"
    sg docker -c "docker compose $COMPOSE_OPTIONS up $COMPOSE_UP_OPTIONS lldap" || {
        log_error "Failed to start LLDAP service for bootstrapping"
        exit 1
    }

    # Run LLDAP's built-in bootstrap script to create/update users and groups
    echo -e "Configuring LLDAP with built-in users and groups...\n"
    sg docker -c "docker exec \
        -e LLDAP_ADMIN_PASSWORD_FILE=/run/secrets/ldap_admin_password \
        -e USER_CONFIGS_DIR=/data/bootstrap/user-configs \
        -e GROUP_CONFIGS_DIR=/data/bootstrap/group-configs \
        -it lldap ./bootstrap.sh" >/dev/null || \
    {
        log_error "Failed to bootstrap LLDAP users and groups"
        exit 1
    }
}

################################################################################
#                             BASE SETUP HOOKS

base_config_env() {
    # Global Settings
    ask_for_env APPDATA_LOCATION "Application Data folder"
    ask_for_env TZ "Server Timezone"
    ask_for_env CERT_ACME_EMAIL "Email For Certificate Registration"

    # Tailscale Settings
    ask_for_env TAILSCALE_API_KEY "Tailscale API Key"

    # Cloudflare Settings
    ask_for_env CF_DNS_API_TOKEN "Cloudflare API Token"
    ask_for_env CF_DOMAIN_NAME "Domain Name (e.g. example.com)"
    save_env CF_DOMAIN_CN "\"$(echo "$CF_DOMAIN_NAME" | sed 's/^/dc=/' | sed 's/\./,dc=/g')\""
    ask_for_env CF_TUNNEL_NAME "Cloudflare Tunnel Name"

    # SMTP Server Settings
    ask_for_env SMTP2GO_API_KEY "SMTP2GO API Key"
    ask_for_env SMTP_SENDER "SMTP Email From (username only)"
    if [ "$USE_SMTP2GO" != "true" ]; then
        ask_for_env SMTP_USERNAME "SMTP Server Username"
        ask_for_env SMTP_PASSWORD "SMTP Server Password"
        ask_for_env SMTP_SERVER "SMTP Server Address"
        ask_for_env SMTP_PORT "SMTP Server Port"
        ask_for_env SMTP_SECURE "SMTP Security Protocol (optional) ('tls' or 'ssl')" true false
    else
        if [ -z "$SMTP_USERNAME" ]; then
            save_env SMTP_USERNAME "selfhost@${CF_DOMAIN_NAME}"
        fi
        ask_for_env SMTP_USERNAME "SMTP Server Username"
    fi

    # Authelia Settings
    ask_for_env AUTHELIA_THEME "Authelia admin website theme (dark | light)"
}

base_config_secrets() {
    save_env_id OIDC_GRAFANA_CLIENT_ID
    save_env_secret "${SECRETS_PATH}cloudflare_dns_api_token" CF_DNS_API_TOKEN
    save_env_secret "${SECRETS_PATH}smtp_password" SMTP_PASSWORD
    create_secret "${SECRETS_PATH}ldap_admin_password"
    create_secret "${SECRETS_PATH}authelia_session_secret"
    create_secret "${SECRETS_PATH}authelia_storage_encryption_key"
    create_secret "${SECRETS_PATH}ldap_jwt_secret"
    create_secret "${SECRETS_PATH}ldap_key_seed"
    create_secret "${SECRETS_PATH}ldap_authelia_password"
    create_secret "${SECRETS_PATH}oidc_hmac_secret"
    create_password_digest_pair "${SECRETS_PATH}oidc_grafana"
    create_rsa_keypair "${SECRETS_PATH}oidc_jwks_key" "${SECRETS_PATH}oidc_jwks_public"
}

base_pre_install() {
    log_header "Preparing LLDAP for deployment"
    lldap_bootstrap

    log_header "Preparing Authelia for deployment"
    configure_authelia

    log_header "Preparing Traefik for deployment"
    configure_traefik
}

CONFIG_ENV_HOOKS+=("base_config_env")
CONFIG_SECRETS_HOOKS+=("base_config_secrets")
PRE_INSTALL_HOOKS+=("base_pre_install")
# POST_INSTALL_HOOKS+=("base_post_install")
# BOOTSTRAP_HOOKS+=("...")