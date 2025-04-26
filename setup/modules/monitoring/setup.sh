#!/bin/bash

if [ -n "$__SETUP_MONITORING" ]; then return 0; fi

__SETUP_MONITORING=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/docker.sh
source "$PROJECT_ROOT/lib/docker.sh"

prometheus_merge_config() {
    local filename="$1"
    local -a file_list=()
    # Create a new array of modules, where 'monitoring' is always in the first position
    # shellcheck disable=SC2207
    local -a modules=("monitoring" $(printf '%s\n' "${ENABLED_MODULES[@]}" | grep -v '^monitoring$'))
    for module in "${modules[@]}"; do
        if [[ -f "${PROJECT_ROOT%/}/modules/$module/prometheus/$filename" ]]; then
            file_list+=("modules/$module/prometheus/$filename")
        fi
    done
    local configuration
    # shellcheck disable=SC2016
    local expr='. as $item ireduce({}; . *+ $item)'
    if ! configuration=$(yq "${PROJECT_ROOT%/}/" ea "$expr" "${file_list[@]}"); then
        log_error "Failed to merge Prometheus configuration"
        return 1
    fi
    configuration=$(env_subst "$configuration")
    write_file "$configuration" "${APPDATA_LOCATION%/}/prometheus/$filename" || {
        log_error "Failed to write Prometheus configuration"
        return 1
    }
}

################################################################################
#                          MONITORING SETUP HOOKS

monitoring_config_env() {
    ask_for_env GRAFANA_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Grafana"
    ask_for_env LOKI_RETENTION_TIME "Retention time for monitoring logs (empty=infinite)" -e
    ask_for_env PROMETHEUS_RETENTION_TIME "Retention time for monitoring metrics (empty=infinite)" -e
    ask_for_env PROMETHEUS_RETENTION_SIZE "Maximum size for monitoring time-series database (empty=infinite)" -e
    ask_for_env SMARTCTL_INTERVAL "Polling interval to retrieve hard-drive statistics"
}

monitoring_config_secrets() {
    save_env_id OIDC_GRAFANA_CLIENT_ID
    create_password_digest_pair "${SECRETS_PATH}oidc_grafana"
}

monitoring_pre_install() {
    prometheus_merge_config "prometheus.yml" || return 1
}

CONFIG_ENV_HOOKS+=("monitoring_config_env")
CONFIG_SECRETS_HOOKS+=("monitoring_config_secrets")
PRE_INSTALL_HOOKS+=("monitoring_pre_install")
# POST_INSTALL_HOOKS+=("")
# BOOTSTRAP_HOOKS+=("")