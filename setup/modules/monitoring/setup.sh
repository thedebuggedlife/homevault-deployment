#!/bin/bash

if [ -n "$__SETUP_MONITORING" ]; then return 0; fi

__SETUP_MONITORING=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/docker.sh
source "$PROJECT_ROOT/lib/docker.sh"

configure_prometheus() {
    local -a file_list=()
    # Create a new array of modules, where 'monitoring' is always in the first position
    local -a modules=("monitoring" $(printf '%s\n' "${ENABLED_MODULES[@]}" | grep -v '^monitoring$'))
    for module in "${modules[@]}"; do
        local config_file="${APPDATA_LOCATION%/}/prometheus/prometheus-${module}.yml"
        if [[ -f "$config_file" ]]; then
            file_list+=("$(basename "$config_file")")
        fi
    done
    local configuration
    # shellcheck disable=SC2016
    local expr='
        (.scrape_configs as $item ireduce ([]; . + $item )) as $configs | 
        [select(fileIndex == 0) * {"scrape_configs":$configs}] |
        .[0]'
    if ! configuration=$(yq "${APPDATA_LOCATION%/}/prometheus" "$expr" "${file_list[@]}"); then
        log_error "Failed to merge Prometheus configuration"
        return 1
    fi
    echo "$configuration" | sed "s/\${HOSTNAME}/$HOSTNAME/g" > "${APPDATA_LOCATION%/}/prometheus/prometheus.yml" || {
        log_error "Failed to write Prometheus configuration"
        return 1
    }
}

################################################################################
#                          MONITORING SETUP HOOKS

monitoring_config_env() {
    ask_for_env GRAFANA_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Grafana"
    ask_for_env PROMETHEUS_RETENTION_TIME "Retention time for monitoring metrics (empty=infinite)" -e
    ask_for_env PROMETHEUS_RETENTION_SIZE "Maximum size for monitoring time-series database (empty=infinite)" -e
    ask_for_env SMARTCTL_INTERVAL "Polling interval to retrieve hard-drive statistics"
}

monitoring_config_secrets() {
    save_env_id OIDC_GRAFANA_CLIENT_ID
    create_password_digest_pair "${SECRETS_PATH}oidc_grafana"
}

monitoring_pre_install() {
    configure_prometheus || return 1
}

CONFIG_ENV_HOOKS+=("monitoring_config_env")
CONFIG_SECRETS_HOOKS+=("monitoring_config_secrets")
PRE_INSTALL_HOOKS+=("monitoring_pre_install")
# POST_INSTALL_HOOKS+=("")
# BOOTSTRAP_HOOKS+=("")