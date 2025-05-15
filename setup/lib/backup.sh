# shellcheck disable=SC2034

if [ -n "$__LIB_BACKUP" ]; then return 0; fi

__LIB_BACKUP=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
# shellcheck source=./config.sh
source "$PROJECT_ROOT/lib/config.sh"

RESTIC_VERSION=0.18
RESTIC_ENV=
RESTIC_INIT_ENV=
RESTIC_REPOSITORY=
RESTIC_CONFIG=

declare -A RESTIC_OVERRIDES

# Backup action: init | run
BACKUP_ACTION=run
BACKUP_KEEP=false

SNAPSHOT_ACTION=list
SNAPSHOT_ID=latest
SNAPSHOT_RETENTION=
declare -a SNAPSHOT_BROWSE_FLAGS=()

RESTORE_ACTION=

################################################################################
#                            RESTIC COMMAND

###
# Runs the Restic utility using a docker container rather than requiring installing it
#
# @option   -v  {list}      Colon-separated list of directories to map
# @option   -m  {manifest}  Manifest JSON file (for backup operations only)
# @param    $@              Any additional parameters are passed down to restic
# @return   {string}        Any output from restic
###
restic() {
    local data_paths manifest_file exit_code
    OPTIND=1
    while getopts ":v:m:" opt; do
        case $opt in
            v) data_paths="$OPTARG" ;;
            m) manifest_file="$OPTARG" ;;
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
    if [ -n "$manifest_file" ]; then
        cmd+=" -v '$manifest_file':/source/manifest.json"
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
    result=$(sg docker -c "$cmd" | tr -d '\r'); exit_code=$?
    echo "$result"
    return $exit_code
}

################################################################################
#                            RESTIC ACTIONS

restic_load_env() {
    RESTIC_ENV="${RESTIC_ENV:-${PROJECT_PATH%/}/restic.env}"

    if [ ! -f "$RESTIC_ENV" ]; then
        log_error "Restic configuration file is missing: '$RESTIC_ENV'"
        return 1
    fi

    # shellcheck source=/dev/null
    source "$RESTIC_ENV"
}

restic_init_env() {
    RESTIC_ENV="${RESTIC_ENV:-${PROJECT_PATH%/}/restic.env}"

    if [ -f "$RESTIC_ENV" ]; then
        log_warn "A previous backup environment exists at '$RESTIC_ENV'"
        ask_confirmation -p "Do you want to recreate the file?" && {
            local bak_file
            bak_file="$RESTIC_ENV.$(date +%s).bak"
            if mv "$RESTIC_ENV" "$bak_file"; then
                echo -e "Previous environment file moved to: ${Cyan}$bak_file${COff}"
            else
                log_error "Failed to move previous backup environment file to: '$bak_file'"
                return 1
            fi
        }
        echo
    fi

    if [ ! -f "$RESTIC_ENV" ]; then
        if [ -n "$RESTIC_INIT_ENV" ]; then  
            echo -e "Copying backup environment file to: ${Cyan}$RESTIC_ENV${COff}"
            cp -f "$RESTIC_INIT_ENV" "$RESTIC_ENV" && chmod 600 "$RESTIC_ENV" || {
                log_error "Failed to create backup environment file: '$RESTIC_ENV'"
                return 1
            }
        else
            echo -e "Creating backup environment file: ${Cyan}$RESTIC_ENV${COff}"
            touch "$RESTIC_ENV" && chmod 600 "$RESTIC_ENV" || {
                log_error "Failed to create backup environment file: '$RESTIC_ENV'"
                return 1
            }
        fi
    fi

    ## TODO: Support assisted initialization of restic for different repository types
    local key
    for key in "${!RESTIC_OVERRIDES[@]}"; do
        save_env "$key" "${RESTIC_OVERRIDES[$key]}" "$RESTIC_ENV"
    done
}

restic_init_repository() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

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

        echo -e "Initializing repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic init -q || {
            log_error "Failed to initialize backup repository"
            return 1
        }
    ) || return 1
}

restic_run_backup() {
    local exit_code
    RESTIC_CONFIG=$(mktemp -d) || {
        log_error "Failed to create temporary working directory for restic"
        return 1
    }

    # Using a subshell to isolate code with access to restic ENV values
    (
        local var_args=() mappings exit_code=0

        restic_load_env || return 1

        mappings=$(IFS=":"; echo "${BACKUP_FILTER_INCLUDE[*]}")
        printf '/source/%s\n' "${BACKUP_FILTER_EXCLUDE[@]/#\//}" > "$RESTIC_CONFIG/file_exclude.txt"

        if [ "$BACKUP_KEEP" = true ]; then var_args+=(--tag keep); fi

        echo -e "Creating new snapshot in repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic -v "$mappings" \
            -m "${PROJECT_PATH%/}/deployment.json" \
            backup \
            --tag "$COMPOSE_PROJECT_NAME" \
            --exclude-file /config/file_exclude.txt \
            "${var_args[@]}" \
            /source || {
                log_error "Backup operation failed"
                return 1
            }
        echo
    ); exit_code=$?

    rm -rf "$RESTIC_CONFIG" > /dev/null 2>&1
    return $exit_code
}

restic_list_snapshots() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        echo -e "Listing snapshots in repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic snapshots \
            --tag "$COMPOSE_PROJECT_NAME" || {
                log_error "Snapshots operation failed"
                return 1
            }

        echo
    ) || return 1
}

restic_browse_snapshot() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        echo -e "Browsing snapshot ${Purple}$SNAPSHOT_ID${COff} in repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        local recursive=""
        if [ "$SNAPSHOT_BROWSE_RECURSIVE" = true ]; then 
            recursive="--recursive"
        fi
        restic ls "$SNAPSHOT_ID" "${SNAPSHOT_BROWSE_FLAGS[@]}" || {
            log_error "Browse operation failed"
            return 1
        }

        echo
    ) || return 1
}

restic_forget_snapshots() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        echo -e "Deleting snapshot ${Purple}$SNAPSHOT_ID${COff} from repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic forget "$SNAPSHOT_ID" || {
                log_error "Forget operation failed"
                return 1
            }

        echo
    ) || return 1
}

restic_dump_file() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        echo -e "Retrieving file ${Purple}$1${COff} from repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n" >&2
        restic dump "$SNAPSHOT_ID" "/source/${1#/}" || {
            log_error "Forget operation failed"
            return 1
        }

        echo
    ) || return 1
}

restic_run_restore() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        local mappings

        restic_load_env || return 1

        mappings=$(IFS=":"; echo "${BACKUP_FILTER_INCLUDE[*]}")

        echo -e "Restoring snapshot ${Purple}$SNAPSHOT_ID${COff} from repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic -v "$mappings" \
            restore "$SNAPSHOT_ID" \
            --target / || {
                log_error "Backup operation failed"
                return 1
            }
        echo
    ) || return 1
}

################################################################################
#                                 BACKUP STEPS

backup_check_requisites() {
    if [[ "${#INSTALLED_MODULES[@]}" -eq 0 ]]; then
        log_error "There are no installed modules to back up."
        return 1
    fi
}

backup_stop_services() {
    if [[ -n "${BACKUP_SERVICES[*]}" && "$DRY_RUN" != true ]]; then
        echo -e "Stopping docker services ..."
        # shellcheck disable=SC2048,SC2086
        docker compose -p "$COMPOSE_PROJECT_NAME" stop ${BACKUP_SERVICES[*]} || {
            log_error "Failed to stop docker services in preparation for backup. Some services may need to be restarted manually."
            return 1
        }
    fi
}

backup_start_services() {
    if [[ -n "${BACKUP_SERVICES[*]}" && "$DRY_RUN" != true ]]; then
        echo -e "Starting docker services ..."
        # shellcheck disable=SC2048,SC2086
        docker compose -p "$COMPOSE_PROJECT_NAME" start ${BACKUP_SERVICES[*]} || {
            log_warn "Failed to restart docker services after backup. Some services may need to be restarted manually."
            return 1
        }
    fi
}

################################################################################
#                                 SNAPSHOTS STEPS



################################################################################
#                                 RESTORE STEPS

restore_check_installed() {
    if [[ "${#INSTALLED_MODULES[@]}" -gt 0 ]]; then
        log_warn "here are ${#INSTALLED_MODULES[@]} modules already installed."
        echo "This operation will destroy and recreate Docker resources for these modules."
        ask_confirmation || return 1
    fi
}

restore_configure_local() {
    if [ -n "$APPDATA_LOCATION" ]; then
        # Copy the .env file used on last deployment
        local restore_env="${APPDATA_LOCATION%/}/project/${COMPOSE_PROJECT_NAME}/.env"
        echo -e "Restoring environment from file ${Cyan}$restore_env${COff}"
        if [ ! -f "$restore_env" ]; then
            log_error "Missing file '$restore_env'"
            return 1
        fi
        cp "$restore_env" "${ENV_FILE}" && chmod 600 "$ENV_FILE" || {
            log_error "Failed to write file '${ENV_FILE}'"
            return 1
        }
    fi

    if [ ! -f "$ENV_FILE" ]; then
        log_error "Could not find environment file '${ENV_FILE}'"
        return 1
    fi

    # shellcheck source=/dev/null
    source "$ENV_FILE"
    implicit_env_vars

    # When reinstalling, the following settings are implied
    OVERRIDE_COMPOSE=false
    OVERRIDE_VERSIONS=true
    NO_DOWNLOAD=true
}

restore_configure_remote() {
    RESTIC_CONFIG=$(mktemp -d)

    local temp_env="$RESTIC_CONFIG/.env"
    if [ -f "$RESTIC_ENV" ]; then
        cp "$RESTIC_ENV" "$temp_env" && chmod 600 "$temp_env" || {
            log_error "Failed to copy env file to '$temp_env'"
            return 1
        }
    else
        touch "$temp_env" && chmod 600 "$temp_env" || {
            log_error "Failed to create env file at '$temp_env'"
            return 1
        }
    fi

    RESTIC_ENV="$temp_env"

    local key
    for key in "${!RESTIC_OVERRIDES[@]}"; do
        echo "$key=${RESTIC_OVERRIDES[$key]}" >> "$RESTIC_ENV"
    done
}

restore_snapshot() {
    local deployment_file="$RESTIC_CONFIG/deployment.json"
    echo -e "Extracting snapshot manifest to ${Cyan}$deployment_file${COff}"
    restic_dump_file "/manifest.json" > "$deployment_file" || {
        log_error "Failed to load remote deployment file"
        return 1
    }

    echo "Loading snapshot manifest"
    load_deployment_file "$deployment_file" || return 1
    echo

    ensure_path_exists "$APPDATA_LOCATION"

    local target_folder
    for target_folder in "${BACKUP_FILTER_INCLUDE[@]}"; do
        ensure_path_exists "$target_folder"
    done
    echo

    echo "Running restic restore operation"
    restic_run_restore || return 1
    echo
}