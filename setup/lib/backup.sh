# shellcheck disable=SC2034

if [ -n "$__LIB_BACKUP" ]; then return 0; fi

__LIB_BACKUP=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
# shellcheck source=./config.sh
source "$PROJECT_ROOT/lib/config.sh"

RESTIC_VERSION=0.18
RESTIC_ENV=
RESTIC_REPOSITORY=
RESTIC_CONFIG=

# Backup action: init | run
BACKUP_ACTION=run

################################################################################
#                            RESTIC COMMAND

###
# Runs the Restic utility using a docker container rather than requiring installing it
#
# @option   -v  {list}      Colon-separated list of directories to map
# @param    $@              Any additional parameters are passed down to restic
# @return   {string}        Any output from restic
###
restic() {
    local data_paths repo_path
    OPTIND=1
    while getopts ":v:" opt; do
        case $opt in
            v) data_paths="$OPTARG" ;;
            \?) log_warn "Invalid option: -$OPTARG" ;;
            :) log_warn "Option -$OPTARG requires an argument" ;;
        esac
    done
    shift $((OPTIND - 1))
    # Bind all directories under the same path in the container
    cmd="docker run -q --rm "
    if [ -n "$data_paths" ]; then
        local path_array
        IFS=':' read -ra path_array <<< "$data_paths"
        for path in "${path_array[@]}"; do
            if [ -n "$path" ]; then
                cmd+=" -v '$path:/source/${path#/}' "
            fi
        done
    fi
    if [ -n "$RESTIC_ENV" ]; then
        cmd+=" --env-file '$RESTIC_ENV' "
    fi
    if [ -d "$RESTIC_CONFIG" ]; then
        cmd+=" -v '$RESTIC_CONFIG:/config' "
    fi
    if [ -d "$RESTIC_REPOSITORY" ]; then
        cmd+=" -v '$RESTIC_REPOSITORY:/repo' "
    fi
    # The restic container
    cmd+="ghcr.io/restic/restic:$RESTIC_VERSION "
    # Pass the rest of the parameters to restic
    for arg in "$@"; do
        cmd+=$(printf " '%s'" "$arg")
    done
    if [ -d "$RESTIC_REPOSITORY" ]; then
        cmd+=" -r /repo "
    fi
    if [ "$DRY_RUN" = true ]; then
        cmd+=" --dry-run "
    fi
    # Execute restic in docker and pass back the result
    result=$(sg docker -c "$cmd" | tr -d '\r')
    local exit_code=$?
    echo "$result"
    return $exit_code
}

restic_init_repository() {
    if [ -f "$RESTIC_ENV" ]; then
        log_warn "A previous backup configuration exists at '$RESTIC_ENV'"
        ask_confirmation -p "Do you want to overwrite this file?" || abort_install
        echo
        local bak_file
        bak_file="$RESTIC_ENV.$(date +%s).bak"
        if mv "$RESTIC_ENV" "$bak_file"; then
            echo -e "Previous configuration file moved to: ${Cyan}$bak_file${COff}"
        else
            log_error "Failed to move previous backup configuration file to: '$bak_file'"
            return 1
        fi
    fi

    echo -e "Creating backup configuration file: ${Cyan}$RESTIC_ENV${COff}"
    touch "$RESTIC_ENV" && chmod 600 "$RESTIC_ENV" || {
        log_error "Failed to create backup configuration file: '$RESTIC_ENV'"
        return 1
    }

    ## TODO: Support assisted initialization of restic for different repository types
    local key
    for key in "${!ENV_OVERRIDES[@]}"; do
        echo "$key=${ENV_OVERRIDES[$key]}" >> "$RESTIC_ENV"
    done

    # shellcheck source=/dev/null
    source "$RESTIC_ENV"

    save_env RESTIC_HOST "${RESTIC_HOST:-$HOSTNAME}" "$RESTIC_ENV"
    if [ -d "$RESTIC_REPOSITORY" ]; then
        # Make sure it is saved as a full path
        save_env RESTIC_REPOSITORY "$(readlink -f "$RESTIC_REPOSITORY")" "$RESTIC_ENV"
    fi

    if [ -z "$RESTIC_PASSWORD" ]; then
        log_warn "A recovery password was not specified. A new one will be been generated for you."
        save_env_id RESTIC_PASSWORD -l 32 -f "$RESTIC_ENV"
        echo -e "Recovery password: ${BIPurple}$RESTIC_PASSWORD${COff}"
        echo -e "Please store this password in a safe place NOW. Press any key to continue..."
        read -n 1 -s -r
        echo
    fi

    echo "Initializing restic repository..."
    restic init -q || {
        log_error "Failed to initialize backup repository"
        return 1
    }
}

restic_run_backup() {
    if [ ! -f "$RESTIC_ENV" ]; then
        log_error "Restic configuration file is missing: '$RESTIC_ENV'"
        return 1
    fi

    # shellcheck source=/dev/null
    source "$RESTIC_ENV"

    if [[ -n "${BACKUP_SERVICES[*]}" && "$DRY_RUN" != true ]]; then
        echo -e "Stopping docker services ..."
        docker compose -p "$COMPOSE_PROJECT_NAME" stop ${BACKUP_SERVICES[*]} || {
            log_error "Failed to stop docker services in preparation for backup. Some services may need to be restarted manually."
            return 1
        }
    fi

    local mappings
    mappings=$(IFS=":"; echo "${BACKUP_FILTER_INCLUDE[*]}")
    RESTIC_CONFIG=$(mktemp -d)
    printf '/source/%s\n' "${BACKUP_FILTER_EXCLUDE[@]/%\//}" > "$RESTIC_CONFIG/file_exclude.txt"

    local exit_code=0
    restic -v "$mappings" backup \
        --tag "$COMPOSE_PROJECT_NAME" \
        --exclude /config/file_exclude.txt \
        /source || {
            exit_code=1
            log_error "Backup operation failed"
        }

    echo

    if [[ -n "${BACKUP_SERVICES[*]}" && "$DRY_RUN" != true ]]; then
        echo -e "Starting docker services ..."
        docker compose -p "$COMPOSE_PROJECT_NAME" start ${BACKUP_SERVICES[*]} || {
            log_warn "Failed to restart docker services after backup. Some services may need to be restarted manually."
            return 1
        }
    fi
}

################################################################################
#                            CONFIGURATION STEPS

configure_backup() {
    log_header "Performing backup operation"

    if [[ "${#INSTALLED_MODULES[@]}" -eq 0 ]]; then
        log_error "There are no installed modules to back up."
        exit 1
    fi

    if [ -z "$APPDATA_LOCATION" ]; then
        log_error "Missing appdata location to restore from."
        exit 1
    fi

    COMPOSE_PATH="${APPDATA_LOCATION%/}/compose/${COMPOSE_PROJECT_NAME}"
    RESTIC_ENV="${COMPOSE_PATH%/}/restic.env"

    ensure_path_exists "$COMPOSE_PATH"

    load_deployment_file || exit 1

    case "$BACKUP_ACTION" in
    init)
        restic_init_repository || exit 1
        ;;
    run)
        restic_run_backup
        local exit_code=$?
        rm -rf "$RESTIC_CONFIG"
        exit $exit_code
        ;;
    esac
}

configure_restore() {
    log_header "Performing restore operation"

    if [[ "${#INSTALLED_MODULES[@]}" -gt 0 ]]; then
        echo -e "${Yellow}There are ${Purple}${#INSTALLED_MODULES[@]}${Yellow} already installed.${COff}"
        echo -e "${Yellow}This operation will destroy and recreate Docker resources for these modules.${COff}"
        echo
        ask_confirmation || abort_install
    fi

    if [ -z "$APPDATA_LOCATION" ]; then
        log_error "Missing appdata location to restore from."
        exit 1
    fi

    COMPOSE_PATH="${APPDATA_LOCATION%/}/compose/${COMPOSE_PROJECT_NAME}"
    RESTIC_ENV="${COMPOSE_PATH%/}/restic.env"

    # When reinstalling, the following settings are implied
    OVERRIDE_COMPOSE=false
    OVERRIDE_VERSIONS=true
    NO_DOWNLOAD=true

    # Copy environment file
    if [ -f "${COMPOSE_PATH%/}/.env" ]; then
        cp "${COMPOSE_PATH%/}/.env" "${ENV_FILE}" || {
            log_error "Failed to write file '${ENV_FILE}'"
            exit 1
        }
    else
        log_error "Missing file '${COMPOSE_PATH%/}/.env'"
        exit 1
    fi

    load_deployment_file "${COMPOSE_PATH%/}/deployment.json" || exit 1
}