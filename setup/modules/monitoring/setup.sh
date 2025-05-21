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
    # shellcheck disable=SC2016
    merge_yaml_config "prometheus.yml" "prometheus" -m "monitoring"
}

################################################################################
#                          MONITORING SETUP HOOKS

monitoring_config_env() {
    ask_for_env GRAFANA_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Grafana" -v "$RE_VALID_LOCAL_HOSTNAME"
    ask_for_env LOKI_RETENTION_TIME "Retention time for monitoring logs (empty=infinite)" -e -v "$RE_VALID_DURATION" -E "$MSG_INVALID_DURATION"
    ask_for_env PROMETHEUS_RETENTION_TIME "Retention time for monitoring metrics (empty=infinite)" -e -v "$RE_VALID_DURATION" -E "$MSG_INVALID_DURATION"
    ask_for_env PROMETHEUS_RETENTION_SIZE "Maximum size for monitoring time-series database (empty=infinite)" -e -v "$RE_VALID_STORAGE_SIZE" -E "$MSG_INVALID_STORAGE_SIZE"
    ask_for_env SMARTCTL_INTERVAL "Polling interval to retrieve hard-drive statistics" -v "$RE_VALID_DURATION" -E "$MSG_INVALID_DURATION"
}

monitoring_config_secrets() {
    save_env_id OIDC_GRAFANA_CLIENT_ID
    create_password_digest_pair "${SECRETS_PATH}oidc_grafana"
}

monitoring_pre_install() {
    log_header "Configuring Prometheus"
    prometheus_merge_config || return 1
}

monitoring_backup_config() {
    BACKUP_SERVICES+=(
        "grafana"
    )
    # shellcheck disable=SC2016
    BACKUP_FILTER_EXCLUDE+=(
        '${APPDATA_LOCATION}/alloy/data'
        '${APPDATA_LOCATION}/loki/data'
        '${APPDATA_LOCATION}/prometheus/data'
    )
}

CONFIG_ENV_HOOKS+=("monitoring_config_env")
CONFIG_SECRETS_HOOKS+=("monitoring_config_secrets")
PRE_INSTALL_HOOKS+=("monitoring_pre_install")
# POST_INSTALL_HOOKS+=("")
# BOOTSTRAP_HOOKS+=("")
BACKUP_CONFIG_HOOKS+=("monitoring_backup_config")