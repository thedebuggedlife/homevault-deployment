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
# Check that Docker is installed
#
# @return void
###
configure_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "\n${Yellow}Docker is not installed.${COff}"
        local user_input=Y
        if [ "$UNATTENDED" != "true" ]; then
            read -p "Do you want to install Docker? [Y/n] " user_input </dev/tty
            user_input=${user_input:-Y}
        fi
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            echo "Installing Docker..."
            if ! curl -fsSL https://get.docker.com | sudo sh; then
                log_error "Docker installation failed"
                exit 1
            else
                echo -e "\n✅ Docker installation completed successfully\n"
            fi
            sudo systemctl enable --now docker > /dev/null
            if ! getent group docker > /dev/null 2>&1; then
                sudo groupadd docker > /dev/null
            fi
            sudo usermod -aG docker $AS_USER > /dev/null
        else
            abort_install
            exit 1
        fi
    fi
}

###
# Find all applicable authelia configuration files
#
# @return {void}
###
configure_authelia() {
    local file_list=""
    local separator=""
    for module in "${ENABLED_MODULES[@]}"; do
        local config_file="${APPDATA_LOCATION%/}/authelia/configuration-${module}.yml"
        # Check if file exists
        if [[ -f "$config_file" ]]; then
            # Add to comma-separated list
            file_list="${file_list}${separator}/config/configuration-${module}.yml"
            # Set separator for subsequent items
            separator=","
        fi
    done
    save_env AUTHELIA_CONFIG "$file_list"
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
    echo -e "Bootstrapping LLDAP with pre-configured users and groups...\n"
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

    # LLDAP Settings
    ask_for_env LLDAP_ADMIN_PASSWORD "LLDAP Administrator Password" true true true

    # Portainer Settings
    ask_for_env PORTAINER_ADMIN_PASSWORD "Portainer Administrator Password" true true true
}

base_config_secrets() {
    save_env_id OIDC_GRAFANA_CLIENT_ID
    save_env_secret "${SECRETS_PATH}cloudflare_dns_api_token" CF_DNS_API_TOKEN
    save_env_secret "${SECRETS_PATH}smtp_password" SMTP_PASSWORD
    save_env_secret "${SECRETS_PATH}ldap_admin_password" LLDAP_ADMIN_PASSWORD
    save_env_secret "${SECRETS_PATH}portainer_admin_password" PORTAINER_ADMIN_PASSWORD
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
    log_header "Configuring Docker"
    configure_docker

    log_header "Configuring Tailscale"
    configure_tailscale

    log_header "Configuring CloudFlare Tunnel"
    configure_cloudflare_tunnel

    log_header "Preparing LLDAP for deployment"
    lldap_bootstrap

    log_header "Preparing Authelia for deployment"
    configure_authelia
}

CONFIG_ENV_HOOKS+=("base_config_env")
CONFIG_SECRETS_HOOKS+=("base_config_secrets")
PRE_INSTALL_HOOKS+=("base_pre_install")
# POST_INSTALL_HOOKS+=("base_post_install")
# BOOTSTRAP_HOOKS+=("...")