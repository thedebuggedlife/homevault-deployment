if [ -n "$__SETUP_NEXTCLOUD" ]; then return 0; fi

__SETUP_NEXTCLOUD=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"

## Environment variables

NEXTCLOUD_TOKEN=

################################################################################
#                         NEXTCLOUD SETUP HOOKS

nextcloud_config_env() {
    ask_for_env NEXTCLOUD_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Nextcloud"
    ask_for_env NEXTCLOUD_DATA_LOCATION "Nextcloud document storage location"
    ask_for_env NEXTCLOUD_FTS_MEMORY_LIMIT "Memory limit for ElasticSearch (units: #m or #g)"
    save_env_id NEXTCLOUD_TOKEN
}

nextcloud_config_secrets() {
    save_env_id OIDC_NEXTCLOUD_CLIENT_ID
    create_secret "${SECRETS_PATH}nextcloud_db_root_password"
    create_secret "${SECRETS_PATH}nextcloud_db_password"
    create_secret "${SECRETS_PATH}nextcloud_elastic_password"
    save_env_secret "${SECRETS_PATH}nextcloud_server_token" NEXTCLOUD_TOKEN
    create_password_digest_pair "${SECRETS_PATH}oidc_nextcloud"
}

nextcloud_pre_install() {
    log_header "Preparing NextCloud for deployment"

    ensure_path_exists "$NEXTCLOUD_DATA_LOCATION"
    
    # Elastic Search requires special permissions on the file which aren't compatible with NC
    if [ ! -s "${SECRETS_PATH}elastic_password" ]; then
        echo "Generating password for ElasticSearch..."
        cp "${SECRETS_PATH}nextcloud_elastic_password" "${SECRETS_PATH}elastic_password"
    fi
    sudo chmod 600 "${SECRETS_PATH}elastic_password"

    # ElasticSearch requires setting the maximum number of memory map areas to at least 262144
    if [ "$(sysctl -n vm.max_map_count)" -lt 262144 ]; then
        echo -e "Setting ${Cyan}vm.max_map_count${COff} to ${Purple}262144${COff}..."
        echo "vm.max_map_count=262144" | sudo tee /etc/sysctl.d/99-elasticsearch.conf > /dev/null && sudo sysctl --system || {
            log_error "Failed to configure vm.max_map_count setting"
            exit 1
        }
    fi

    # Provide proper access to ElasticSearch data location
    local search_path="${APPDATA_LOCATION%/}/nextcloud/search"
    ensure_path_exists "$search_path"
    echo -e "Changing ownership of ${Cyan}$search_path${COff} to ${Purple}1000:0${COff}"
    sudo chown 1000:0 "${APPDATA_LOCATION%/}/nextcloud/search"

    # For NextCloud to respect X-Forwarded-* headers the CIDR that includes traefik and nextcloud should be
    # added to the trusted proxies. Otherwise, NextCloud will not receive original IP and protocol of the request.
    if [ -z "$NEXTCLOUD_TRUSTED_PROXIES" ]; then
        echo "Creating Docker resources for NextCloud to extract network address..."
        if ! sg docker -c "docker compose $COMPOSE_OPTIONS create -y --quiet-pull nextcloud-app"; then
            log_error "Failed to create container resources for NextCloud"
            exit 1
        fi
        local trusted_proxies
        if ! trusted_proxies=$(docker network inspect "nextcloud-proxy" -f '{{(index .IPAM.Config 0).Subnet}}'); then
            log_error "Could not extract network IP CIDR for 'nextcloud-proxy'"
            exit 1
        fi
        save_env NEXTCLOUD_TRUSTED_PROXIES "$trusted_proxies"
    fi
}

CONFIG_ENV_HOOKS+=("nextcloud_config_env")
CONFIG_SECRETS_HOOKS+=("nextcloud_config_secrets")
PRE_INSTALL_HOOKS+=("nextcloud_pre_install")
# POST_INSTALL_HOOKS+=(...)
# BOOTSTRAP_HOOKS+=(...)