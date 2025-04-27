#!/bin/bash

if [ -n "$__SETUP_HOMEPAGE" ]; then return 0; fi

__SETUP_HOMEPAGE=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/docker.sh
source "$PROJECT_ROOT/lib/docker.sh"

homepage_merge_config() {
    local filename="$1"
    local filetype="$2"
    local -a file_list=()
    # Create a new array of modules, where 'homepage' is always in the first position
    # shellcheck disable=SC2207
    local -a modules=("homepage" $(printf '%s\n' "${ENABLED_MODULES[@]}" | grep -v '^homepage$'))
    for module in "${modules[@]}"; do
        if [[ -f "${PROJECT_ROOT%/}/modules/$module/homepage/$filename" ]]; then
            file_list+=("modules/$module/homepage/$filename")
        fi
    done
    local expr configuration
    if [ "$filetype" = "arrays" ]; then
        # shellcheck disable=SC2016
        expr='.[] as $item ireduce([]; . + $item)'
    elif [ "$filetype" = "groups" ]; then
        # shellcheck disable=SC2016
        expr='(.[] as $item ireduce({}; . *+ $item)) as $map | ($map | keys | .[]) as $key ireduce([]; . + [{$key: $map[$key]}])'
    else
        # shellcheck disable=SC2016
        expr='. as $item ireduce({}; . *+ $item)'
    fi
    if ! configuration=$(yq "${PROJECT_ROOT%/}/" ea "$expr" "${file_list[@]}"); then
        log_error "Failed to merge Homepage configuration"
        return 1
    fi
    configuration=$(env_subst "$configuration")
    write_file "$configuration" "${APPDATA_LOCATION%/}/homepage/config/$filename" || {
        log_error "Failed to write Homepage configuration"
        return 1
    }
}

################################################################################
#                          HOMEPAGE SETUP HOOKS

homepage_config_env() {
    ask_for_env HOMEPAGE_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Homepage"
}

homepage_bootstrap() {
    # These steps require some of the work done during post-install, hence running as bootstrap
    log_header "Generating Homepage configuration"
    homepage_merge_config "settings.yaml" || return 1
    homepage_merge_config "bookmarks.yaml" groups || return 1
    homepage_merge_config "services.yaml" groups || return 1
    homepage_merge_config "widgets.yaml" arrays || return 1
}

CONFIG_ENV_HOOKS+=("homepage_config_env")
# CONFIG_SECRETS_HOOKS+=("")
# PRE_INSTALL_HOOKS+=("")
# POST_INSTALL_HOOKS+=("")
BOOTSTRAP_HOOKS+=("homepage_bootstrap")