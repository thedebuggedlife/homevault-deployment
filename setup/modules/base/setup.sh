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

_PAM_USER_CONFIG="lldap/bootstrap/user-configs/pam.json"
_ADMIN_USER_CONFIG="lldap/bootstrap/user-configs/admin.json"
_SERVER_ADMIN_GROUP_CONFIG="lldap/bootstrap/group-configs/server_admin.json"
_SSSD_CONFIG_PATH="/etc/sssd/sssd.conf"

###
# Create dynamic configuration files for enabled modules
#
# @return: {void}
###
configure_traefik() {
    merge_yaml_config "dynamic.yml" traefik
}

###
# Merge all applicable authelia configuration files
#
# @return {void}
###
configure_authelia() {
    # If no OIDC clients are configured (depending on the number of selected modules)
    # then a 'dummy' client is inserted as Authelia requires a non-empty definition
    # for .identity_providers.oidc.clients

    # shellcheck disable=SC2016
    local expr='
        . as $item ireduce({}; . *+ $item) | 
        with(
            .identity_providers.oidc; 
            select(.clients == null or .clients == []) | 
            .clients = [
                {
                    "client_id":"dummy",
                    "public":true,
                    "redirect_uris":["https://dummy.example.com"]
                }
            ]
        )'
    merge_yaml_config "configuration.yml" "authelia" -e "$expr"
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

    log "Starting LLDAP service...\n"
    sg docker -c "docker compose $COMPOSE_OPTIONS up $COMPOSE_UP_OPTIONS lldap" || {
        log_error "Failed to start LLDAP service for bootstrapping"
        exit 1
    }

    # Run LLDAP's built-in bootstrap script to create/update users and groups
    log "Configuring LLDAP with built-in users and groups...\n"
    sg docker -c "docker exec \
        -e LLDAP_ADMIN_PASSWORD_FILE=/run/secrets/ldap_admin_password \
        -e USER_CONFIGS_DIR=/data/bootstrap/user-configs \
        -e GROUP_CONFIGS_DIR=/data/bootstrap/group-configs \
        -e USER_SCHEMAS_DIR=/data/bootstrap/user-schemas \
        -e GROUP_SCHEMAS_DIR=/data/bootstrap/group-schemas \
        -it lldap /data/bootstrap/bootstrap.sh" >/dev/null || \
    {
        log_error "Failed to bootstrap LLDAP users and groups"
        exit 1
    }
}

################################################################################
#                             PAM CONFIGURATION

pam_write_sssd_config() {
    local pam_username=$1
    local pam_password=$2

    if [ -f "$_SSSD_CONFIG_PATH" ]; then
        local user_input
        if ! sudo grep -Fq "$CF_DOMAIN_NAME" "$_SSSD_CONFIG_PATH"; then
            log_warn "SSSD configuration file exists but does not seem to be configured for '$CF_DOMAIN_NAME'"
            if [ "$UNATTENDED" = true ]; then return 1; fi
            read -p "Do you want to override the existing configuration? [y/N] " user_input </dev/tty
            user_input=${user_input:-N}
            if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
                abort_install
            fi
        else
            log "Configuration for ${Purple}$CF_DOMAIN_NAME${COff} already present in ${Cyan}$_SSSD_CONFIG_PATH${COff}"
            if [ "$USE_DEFAULTS" = true ]; then return 0; fi
            read -p "Do you want to override the existing configuration? [y/N] " user_input </dev/tty
            user_input=${user_input:-N}
            if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
                return 0
            fi
        fi
    fi

    log "Generating configuration file ${Cyan}$_SSSD_CONFIG_PATH${COff}"

    cat "$PROJECT_ROOT/modules/base/sssd.conf" \
        | sed "s/\${CF_DOMAIN_NAME}/$CF_DOMAIN_NAME/g" \
        | sed "s/\${CF_DOMAIN_CN}/$CF_DOMAIN_CN/g" \
        | sed "s/\${BIND_USERNAME}/$pam_username/g" \
        | sed "s/\${BIND_PASSWORD}/$pam_password/g" \
        | sed "s|\${LLDAP_CERT_FILE}|${APPDATA_LOCATION%/}/lldap/cert.pem|g" \
        | sudo tee "$_SSSD_CONFIG_PATH" >/dev/null &&
        sudo chmod 600 "$_SSSD_CONFIG_PATH" || {
            log_error "Failed to write SSSD configuration to '$_SSSD_CONFIG_PATH'"
            return 1
        }
}

pam_update_administrator_config() {
    local admin_config="${APPDATA_LOCATION%/}/$_ADMIN_USER_CONFIG"
    local username home_dir home_prefix unix_shell group_len user_group json
    # Read the LLDAP bootstrap file for the admin user
    if ! json=$(< "$admin_config"); then
        log_error "Failed to read admin user configuration from '$admin_config'"
        return 1
    fi
    # Get the user name (id)
    username=$(echo "$json" | jq -r '.id')
    if [ -z "$username" ]; then
        log_error "Failed to read username (id) from '$admin_config'"
        return 1
    fi
    # Check if username already exists in local (files) source
    if getent -s files passwd "$username" >/dev/null; then
        log_warn "There is a local account for '$username' which will take precedence over SSSD"
    fi
    # Set the home directory, if not set already
    home_dir=$(echo "$json" | jq -r '.homeDirectory')
    if [ -z "$home_prefix" ]; then
        home_prefix=$(useradd -D | grep -E "^HOME=" | cut -d= -f2)
        if [ -z "$home_prefix" ]; then
            log_error "Could not get default home directory"
            return 1
        fi
        home_dir="$home_prefix/$username"
        if ! json=$(echo "$json" | jq --arg homeDirectory "$home_dir" '.homeDirectory=$homeDirectory'); then
            log_error "Failed to update JSON for admin user configuration"
            return 1
        fi
    fi
    # Set the default shell, if not set already
    unix_shell=$(echo "$json" | jq -r '.unixShell')
    if [ -z "$unix_shell" ]; then
        if [ -f "/bin/bash" ]; then
            unix_shell=/bin/bash
        elif [ -f "$SHELL" ]; then
            unix_shell="$SHELL"
        else
            unix_shell=$(useradd -D | grep -E "^SHELL=" | cut -d= -f2)
            if [ -z "$unix_shell" ]; then
                log_error "Could not guess default shell"
                return 1
            fi
        fi
        if ! json=$(echo "$json" | jq --arg unixShell "$unix_shell" '.unixShell=$unixShell'); then
            log_error "Failed to update JSON for admin user configuration"
            return 1
        fi
    fi
    # Add the default user group, if none is set
    group_len=$(echo "$json" | jq -r '.gidNumber | length')
    if [ "$group_len" -eq 0 ]; then
        user_group=$(useradd -D | grep -E "^GROUP=" | cut -d= -f2)
        if [ -z "$user_group" ]; then
            log_error "Could not get default user group"
            return 1
        fi
        if ! json=$(echo "$json" | jq --arg gidNumber "$user_group" '.gidNumber=[$gidNumber]'); then
            log_error "Failed to update JSON for admin user configuration"
            return 1
        fi
    fi
    # Write the updated file
    write_file "$json" "$admin_config" || return 1
}

pam_update_server_admin() {
    local server_admin_config="${APPDATA_LOCATION%/}/$_SERVER_ADMIN_GROUP_CONFIG"
    local gid sudo_gid json
    # Read the current configuration for server_admin
    if ! json=$(< "$server_admin_config"); then
        log_error "Failed to read server_admin group configuration from '$server_admin_config'"
        return 1
    fi
    # Set the GID to match 'sudo', if not set
    gid=$(echo "$json" | jq -r '.gidNumber')
    if [ -z "$gid" ]; then
        sudo_gid=$(getent group sudo | cut -d: -f3)
        if [ -z "$sudo_gid" ]; then
            log_error "Failed to get GID for sudo"
            return 1
        fi
        if ! json=$(echo "$json" | jq --arg gid "$sudo_gid" '.gidNumber=$gid'); then
            log_error "Failed to update JSON for server_admin group configuration"
            return 1
        fi
    fi
    # Write the updated fule
    write_file "$json" "$server_admin_config" || return 1
}

pam_generate_ssl_cert() {
    # SSSD requires LDAPS (SSL)

    ensure_path_exists "${APPDATA_LOCATION%/}/lldap" || return 1
    if [[ -f "${APPDATA_LOCATION%/}/lldap/key.pem" && -f "${APPDATA_LOCATION%/}/lldap/cert.pem" ]]; then
        log "SSL certificates for LLDAP already exist"
        return 0
    fi

    log "Generating SSL certificates for LLDAP"
    openssl req \
        -x509 \
        -nodes \
        -newkey \
        rsa:4096 \
        -keyout "${APPDATA_LOCATION%/}/lldap/key.pem" \
        -out "${APPDATA_LOCATION%/}/lldap/cert.pem" \
        -sha256 \
        -days 36500 \
        -nodes \
        -subj "/CN=lldap.${CF_DOMAIN_NAME}" \
        -addext "subjectAltName = DNS:lldap.${CF_DOMAIN_NAME}" >/dev/null 2>&1 || {
            log_error "Failed to generate SSL certificates for LLDAP"
            return 1
        }
}

lldap_add_to_hosts_file() {
    if ! grep -Fq "${CF_DOMAIN_NAME}" /etc/hosts; then
        log "Adding redirection for ${Purple}lldap.${CF_DOMAIN_NAME}${COff} to ${Cyan}/etc/hosts${COff}"
        local temp_file
        temp_file=$(mktemp)
        echo "127.0.0.1 lldap.${CF_DOMAIN_NAME}" | cat - /etc/hosts > "$temp_file"
        sudo mv "$temp_file" /etc/hosts
    fi
}

pam_pre_install() {
    ensure_packages_installed "sssd sssd-tools libnss-sss libpam-sss libsss-sudo" || return 1

    local pam_user_config="${APPDATA_LOCATION%/}/$_PAM_USER_CONFIG"
    local pam_username pam_password json

    if ! pam_password=$(< "${SECRETS_PATH}ldap_pam_password"); then
        log_error "Could not read PAM password for LLDAP from '${SECRETS_PATH}ldap_pam_password'"
        return 1
    fi
    if ! json=$(< "$pam_user_config"); then
        log_error "Failed to read PAM user configuration from '$pam_user_config'"
        return 1
    fi
    if ! pam_username=$(echo "$json" | jq -r '.id') || [ -z "$pam_username" ]; then
        log_error "Failed to read PAM user ID from '$pam_user_config'"
        return 1
    fi
    if ! json=$(echo "$json" | jq --arg password "$pam_password" '.password = $password'); then
        log_error "Failed to update JSON for PAM user configuration"
        return 1
    fi

    write_file "$json" "$pam_user_config" || return 1
    pam_write_sssd_config "$pam_username" "$pam_password" || return 1
    pam_update_administrator_config || return 1
    pam_update_server_admin || return 1
    pam_generate_ssl_cert || return 1
}

pam_post_install() {
    sudo pam-auth-update --enable mkhomedir
    log "Clearing SSSD cache"
    sudo sss_cache -E
    log "Restarting service ${Cyan}sssd${COff}"
    sudo systemctl restart sssd
}

configure_backup() {
    # shellcheck disable=SC2030
    (
        # Save files used by background backup container
        ensure_path_exists "${APPDATA_LOCATION%/}/backup/config"

        BACKUP_SERVICES=()
        BACKUP_FILTER_EXCLUDE=()
        execute_hooks "${BACKUP_CONFIG_HOOKS[@]}" "backup-config" || return 1
        save_env BACKUP_COMPOSE_PROJECT "$COMPOSE_PROJECT_NAME" || return 1
        save_env BACKUP_SERVICES "'${BACKUP_SERVICES[*]}'" || return 1

        readarray -t backup_exclude < <(env_subst "${BACKUP_FILTER_EXCLUDE[@]}")
        printf "${RESTIC_DATA_ROOT}"'%s\n' "${backup_exclude[@]}" > "${APPDATA_LOCATION%/}/backup/config/file_exclude.txt"

    ) || return 1
}

################################################################################
#                             BASE SETUP HOOKS

base_config_webui() {
    webui_add_prompt base APPDATA_LOCATION "Application Data folder" -v "$RE_VALID_PATH"
    webui_add_prompt base TZ "Server Timezone" -v "is_valid_timezone##Please enter a valid timezone. See: https://timeapi.io/documentation/iana-timezones"
    webui_add_prompt base TAILSCALE_API_KEY "Tailscale API Key"
    webui_add_prompt base CF_DNS_API_TOKEN "Cloudflare API Token"
    webui_add_prompt base CF_DOMAIN_NAME "Domain Name (e.g. example.com)" -v "$RE_MAIN_DOMAIN"
    webui_add_prompt base CF_TUNNEL_NAME "Cloudflare Tunnel Name" -v "$RE_VALID_TUNNEL_NAME"
    webui_add_prompt base USE_SMTP2GO "Do you want to configure SMTP2GO for outgoing email?" -o "true,false"
    webui_add_prompt base SMTP_SENDER "SMTP Email From (username only)" -v "$RE_VALID_EMAIL_NAME"
    webui_add_prompt base SMTP_USERNAME "SMTP Server Username" -c "USE_SMTP2GO==false"
    webui_add_prompt base SMTP_PASSWORD "SMTP Server Password" -c "USE_SMTP2GO==false"
    webui_add_prompt base SMTP_SERVER "SMTP Server Address" -v "$RE_VALID_HOSTNAME" -c "USE_SMTP2GO==false"
    webui_add_prompt base SMTP_PORT "SMTP Server Port" -v "$RE_VALID_PORT_NUMBER" -c "USE_SMTP2GO==false"
    webui_add_prompt base SMTP_SECURE "SMTP Security Protocol (optional)" -e -o "tls,ssl" -c "USE_SMTP2GO==false"
    webui_add_prompt base SMTP2GO_API_KEY "SMTP2GO API Key" -c "USE_SMTP2GO==true"
    webui_add_prompt base AUTHELIA_THEME "Authelia admin website theme" -o "dark,light"
}

base_config_env() {
    # Global Settings
    ask_for_env APPDATA_LOCATION "Application Data folder" -v "$RE_VALID_PATH"
    ask_for_env TZ "Server Timezone" -v "is_valid_timezone##Please enter a valid timezone. See: https://timeapi.io/documentation/iana-timezones"
    save_env HOSTNAME "${HOSTNAME}"
    save_env INSTALLER_UID "$(id -u "$USER")"
    save_env DOCKER_GID "$(getent group docker | cut -d: -f3)"

    # Tailscale Settings
    ask_for_env TAILSCALE_API_KEY "Tailscale API Key"

    # Cloudflare Settings
    ask_for_env CF_DNS_API_TOKEN "Cloudflare API Token"
    ask_for_env CF_DOMAIN_NAME "Domain Name (e.g. example.com)" -v "$RE_MAIN_DOMAIN"
    save_env CF_DOMAIN_CN "\"$(echo "$CF_DOMAIN_NAME" | sed 's/^/dc=/' | sed 's/\./,dc=/g')\""
    ask_for_env CF_TUNNEL_NAME "Cloudflare Tunnel Name" -v "$RE_VALID_TUNNEL_NAME"

    # SMTP Server Settings
    if [ -z "$USE_SMTP2GO" ]; then
        log
        if ask_confirmation -p "Do you want to configure SMTP2GO for outgoing email?" -y; then
            save_env USE_SMTP2GO true
        else
            save_env USE_SMTP2GO false
        fi
    fi
    ask_for_env SMTP_SENDER "SMTP Email From (username only)" -v "$RE_VALID_EMAIL_NAME"
    if [ "$USE_SMTP2GO" != "true" ]; then
        ask_for_env SMTP_USERNAME "SMTP Server Username" -v "$RE_VALID_EMAIL_NAME"
        ask_for_env SMTP_PASSWORD "SMTP Server Password"
        ask_for_env SMTP_SERVER "SMTP Server Address" -v "$RE_VALID_HOSTNAME"
        ask_for_env SMTP_PORT "SMTP Server Port" -v "$RE_VALID_PORT_NUMBER"
        ask_for_env SMTP_SECURE "SMTP Security Protocol (optional)" -e -o "tls,ssl"
    else
        ask_for_env SMTP2GO_API_KEY "SMTP2GO API Key"
        ask_for_env SMTP_USERNAME "SMTP Server Username" -a "homevault@${CF_DOMAIN_NAME}"
    fi

    # Authelia Settings
    ask_for_env AUTHELIA_THEME "Authelia admin website theme" -o "dark,light"
}

base_config_secrets() {
    save_env_id OIDC_GRAFANA_CLIENT_ID
    save_env_secret "${SECRETS_PATH}cloudflare_dns_api_token" CF_DNS_API_TOKEN
    save_env_secret "${SECRETS_PATH}smtp_password" SMTP_PASSWORD
    create_secret "${SECRETS_PATH}ldap_admin_password"
    create_secret "${SECRETS_PATH}ldap_pam_password"
    create_secret "${SECRETS_PATH}authelia_session_secret"
    create_secret "${SECRETS_PATH}authelia_storage_encryption_key"
    create_secret "${SECRETS_PATH}ldap_jwt_secret"
    create_secret "${SECRETS_PATH}ldap_key_seed"
    create_secret "${SECRETS_PATH}ldap_authelia_password"
    create_secret "${SECRETS_PATH}oidc_hmac_secret"
    create_password_digest_pair "${SECRETS_PATH}oidc_grafana"
    create_rsa_keypair "${SECRETS_PATH}oidc_jwks_key" "${SECRETS_PATH}oidc_jwks_public"
}

base_compose_extra() {
    if [ "$BACKUP_ENABLED" = true ]; then
        echo "backup:$(dirname "${BASH_SOURCE[0]}")/docker-compose.backup.yml:base"
    fi
}

base_pre_install() {
    log_header "Configuring PAM support for LLDAP"
    pam_pre_install || return 1

    log_header "Preparing LLDAP for deployment"
    lldap_bootstrap || return 1
    lldap_add_to_hosts_file || return 1

    log_header "Preparing Authelia for deployment"
    configure_authelia || return 1

    log_header "Preparing Traefik for deployment"
    configure_traefik || return 1

    if [ "$BACKUP_ENABLED" = true ]; then
        log_header "Preparing backup configuration"
        configure_backup || return 1
    fi
}

base_post_install() {
    log_header "Post-install steps for LLDAP"
    pam_post_install || return 1
}

base_backup_config() {
    # shellcheck disable=SC2031
    BACKUP_SERVICES+=(
        "authelia"
        "lldap"
        "traefik"
        "trafego"
    )
    # shellcheck disable=SC2016
    BACKUP_FILTER_INCLUDE+=(
        '${APPDATA_LOCATION}'
    )
}

CONFIG_WEBUI_HOOKS+=("base_config_webui")
CONFIG_ENV_HOOKS+=("base_config_env")
CONFIG_SECRETS_HOOKS+=("base_config_secrets")
COMPOSE_EXTRA_HOOKS+=("base_compose_extra")
PRE_INSTALL_HOOKS+=("base_pre_install")
POST_INSTALL_HOOKS+=("base_post_install")
BACKUP_CONFIG_HOOKS+=("base_backup_config")
# BOOTSTRAP_HOOKS+=("...")