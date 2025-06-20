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
RESTIC_DATA_ROOT=/data

declare -A RESTIC_OVERRIDES

# Set with hv backup <action>
BACKUP_ACTION=
# Set with hv backup run --keep
BACKUP_KEEP=false
# Set with hv backup info --env-only
BACKUP_ENV_ONLY=false

# Indicates whether background backups are set to run automatically
BACKUP_ENABLED=
# Set with $0 backup schedule [--enable|--disable]
BACKUP_ENABLED_CHANGE=

# The CRON expression used by the background backup runner
BACKUP_SCHEDULE=
# Set with $0 backup schedule --cron <expr>
BACKUP_SCHEDULE_CHANGE=

# The policy used after a background backup to prune available snapshots
BACKUP_RETENTION_POLICY=
# Set with $0 backup schedule --retention <policy>
BACKUP_RETENTION_POLICY_CHANGE=

# Set with hv snapshots <action>
SNAPSHOT_ACTION=
SNAPSHOT_ID=latest
SNAPSHOT_RETENTION=
declare -a SNAPSHOT_BROWSE_FLAGS=()

# Set with hv restore <action>
RESTORE_ACTION=

################################################################################
#                         PARAMETER VALIDATION

validate_cron_month() {
    local field="$1"
    local month="^(\\*|\\*/([1-9]|1[0-2])|([1-9]|1[0-2])(-([1-9]|1[0-2]))?(,([1-9]|1[0-2])(-([1-9]|1[0-2]))?)*)$|^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$"
    (
        # Run in a subshell to avoid affecting global behavior with shopt
        shopt -s nocasematch
        if [[ ! $field =~ $month ]]; then
            return 1
        fi
    )
    return $?
}

validate_cron_dow() {
    local field="$1"
    local dow="^(\\*|\\*/[0-7]|[0-7](-[0-7])?(,[0-7](-[0-7])?)*)$|^(SUN|MON|TUE|WED|THU|FRI|SAT)$"
    (
        # Run in a subshell to avoid affecting global behavior with shopt
        shopt -s nocasematch
        if [[  ! $field =~ $dow ]]; then
            return 1
        fi
    )
    return $?
}

###
# Validates that the parameter is a valid cron expression
# @param    $1  {string}    Cron expression to validate
# @return       {string}    Validation error if the expression is invalid
# @status       {number}    0 if valid, 1 if invalid
###
validate_cron_regex() {
    local cron_expr="$1"
    
    # First, split and count the fields
    # shellcheck disable=SC2206
    IFS=' ' read -r -a fields <<< "$cron_expr"
    local field_count=${#fields[@]}
    
    if [[ $field_count -ne 5 && $field_count -ne 6 ]]; then
        echo "Invalid: Expected 5 or 6 fields, got $field_count"
        return 1
    fi
    
    # Define regex patterns for each field
    local second_minute="^(\\*|\\*/[0-5]?[0-9]|[0-5]?[0-9](-[0-5]?[0-9])?(,[0-5]?[0-9](-[0-5]?[0-9])?)*)$"
    local hour="^(\\*|\\*/([0-9]|1[0-9]|2[0-3])|([0-9]|1[0-9]|2[0-3])(-([0-9]|1[0-9]|2[0-3]))?(,([0-9]|1[0-9]|2[0-3])(-([0-9]|1[0-9]|2[0-3]))?)*)$"
    local dom="^(\\*|\\*/([1-9]|[12][0-9]|3[01])|([1-9]|[12][0-9]|3[01])(-([1-9]|[12][0-9]|3[01]))?(,([1-9]|[12][0-9]|3[01])(-([1-9]|[12][0-9]|3[01]))?)*)$"

    local index=0

    # Validate based on field count
    if [[ $field_count -eq 6 ]]; then
        # Validate with seconds: seconds, minutes, hours, dom, month, dow
        if ! [[ ${fields[$index]} =~ $second_minute ]]; then
            echo "Invalid seconds field: ${fields[$index]}"
            return 1
        fi
        ((index++))
    fi
    if ! [[ ${fields[$index]} =~ $second_minute ]]; then
        echo "Invalid minutes field: ${fields[$index]}"
        return 1
    fi
    ((index++))
    if ! [[ ${fields[$index]} =~ $hour ]]; then
        echo "Invalid hours field: ${fields[$index]}"
        return 1
    fi
    ((index++))
    if ! [[ ${fields[$index]} =~ $dom ]]; then
        echo "Invalid day-of-month field: ${fields[$index]}"
        return 1
    fi
    ((index++))
    if ! validate_cron_month "${fields[$index]}"; then
        echo "Invalid month field: ${fields[$index]}"
        return 1
    fi
    ((index++))
    if ! validate_cron_dow "${fields[$index]}"; then
        echo "Invalid day-of-week field: ${fields[$index]}"
        return 1
    fi
}

###
# Validates that the parameter is a valid retention policy expression
# @param    $1  {string}    Retention policy expression to validate
# @return       {string}    Validation error if the expression is invalid
# @status       {number}    0 if valid, 1 if invalid
###
validate_retention_policy() {
    local policy="$1"
    local retention_regex="^([0-9]+[h])?([0-9]+[d])?([0-9]+[w])?([0-9]+[m])?([0-9]+[y])?$"
    
    if [[ -z "$policy" ]]; then
        echo "Invalid: Retention policy cannot be empty"
        return 1
    fi

    if [ "$policy" = "all" ]; then return 0; fi
    
    (
        # Run in a subshell to avoid affecting global behavior with shopt
        shopt -s nocasematch
        if ! [[ $policy =~ $retention_regex ]]; then
            echo "Invalid: Retention policy format should be a combination of #h, #d, #w, #m, #y"
            return 1
        fi
    ) || return 1
}

################################################################################
#                            RESTIC COMMAND

###
# Runs the Restic utility using a docker container rather than requiring installing it
#
# @option   -v  {list}      Colon-separated list of directories to map
# @option   -m  {manifest}  Manifest JSON file (for backup operations only)
# @option   -e  {path}      File with environment variables to use for restic. Defaults to: $RESTIC_ENV.
# @param    $@              Any additional parameters are passed down to restic
# @return   {string}        Any output from restic
###
restic() {
    local data_paths manifest_file exit_code
    local env_file="$RESTIC_ENV"
    OPTIND=1
    while getopts ":v:m:e:" opt; do
        case $opt in
            v) data_paths="$OPTARG" ;;
            m) manifest_file="$OPTARG" ;;
            e) env_file="$OPTARG" ;;
            \?) log_warn "Invalid option: -$OPTARG" ;;
            :) log_warn "Option -$OPTARG requires an argument" ;;
        esac
    done
    shift $((OPTIND - 1))
    # Bind all directories under the same path in the container
    cmd="docker run -q --rm -e TZ=$TZ"
    if [ -n "$data_paths" ]; then
        local path_array
        IFS=':' read -ra path_array <<< "$data_paths"
        for path in "${path_array[@]}"; do
            if [ -n "$path" ]; then
                cmd+=" -v '$path:$RESTIC_DATA_ROOT/${path#/}' "
            fi
        done
    fi
    if [ -n "$manifest_file" ]; then
        cmd+=" -v '$manifest_file':$RESTIC_DATA_ROOT/manifest.json"
    fi
    if [ -n "$env_file" ]; then
        cmd+=" --env-file '$env_file' "
    fi
    if [ -d "$RESTIC_CONFIG" ]; then
        cmd+=" -v '$RESTIC_CONFIG:/config' "
    fi
    if [ -d "$RESTIC_REPOSITORY" ]; then
        cmd+=" -v '$RESTIC_REPOSITORY:/repo' "
    fi
    if [ -d "${APPDATA_LOCATION%/}/backup/cache" ]; then
        cmd+=" -v ${APPDATA_LOCATION%/}/backup/cache:/cache -e RESTIC_CACHE_DIR=/cache "
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
    RESTIC_ENV="${RESTIC_ENV:-${APPDATA_LOCATION%/}/backup/restic.env}"

    if [ ! -f "$RESTIC_ENV" ]; then
        log_error "Restic configuration file is missing: '$RESTIC_ENV'"
        return 1
    fi

    log "Using restic environment: ${Cyan}$RESTIC_ENV${COff}"
    # shellcheck source=/dev/null
    source "$RESTIC_ENV"
}

restic_print_env() {
    local env_file="${RESTIC_ENV:-${APPDATA_LOCATION%/}/backup/restic.env}"
    local private_keys=("RESTIC_PASSWORD" "AWS_SECRET_ACCESS_KEY")

    if [ ! -f "$env_file" ]; then
        log_warn "The repository for backups has not been initialized"
        return 0
    fi

    log_header "Repository Configuration"

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Check if line matches KEY=VALUE pattern
        if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            
            # Remove leading/trailing whitespace from key
            key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            
            # Check if key is in private_keys array
            local is_private=false
            for private_key in "${private_keys[@]}"; do
                if [[ "$key" == "$private_key" ]]; then
                    is_private=true
                    break
                fi
            done
            
            # Prepare values for display and JSON
            local display_value="$value"
            
            if [[ "$is_private" == true ]]; then
                display_value="*******"
            fi
            
            # Print to console
            log "${key}=${display_value}"
            
            # Add to JSON_OUTPUT using jq
            JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg k "$key" --arg v "$value" '.backup.env[$k] = $v')
        fi
    done < "$env_file"

    log
}

###
# Generates an .env file for use with restic
#
# @param    $1  {path}  Path to the .env file to create
###
restic_init_env() {
    local temp_env=$1

    ## TODO: Support assisted initialization of restic for different repository types

    if [ -n "$RESTIC_INIT_ENV" ]; then
        copy_env_values "$RESTIC_INIT_ENV" "$temp_env" -o || return 1
    fi

    local key
    for key in "${!RESTIC_OVERRIDES[@]}"; do
        save_env "$key" "${RESTIC_OVERRIDES[$key]}" "$temp_env"
    done

    source "$temp_env"
}

###
# Copies a temporary restic .env file to the path where it'll be used for backup/snapshot operations
#
# @param    $1  {path}      Path to the temporary .env file
###
restic_copy_env() {
    local temp_env=$1

    if [ ! -f "$temp_env" ]; then
        log_error "File '$temp_env' does not exist"
        return 1
    fi

    RESTIC_ENV="${RESTIC_ENV:-${APPDATA_LOCATION%/}/backup/restic.env}"

    if [ -f "$RESTIC_ENV" ]; then
        local bak_file
        bak_file="$RESTIC_ENV.$(date +%s).bak"
        log_warn "A previous restic environment exists at '$RESTIC_ENV'"
        if mv "$RESTIC_ENV" "$bak_file"; then
            log "Previous environment file moved to: ${Cyan}$bak_file${COff}"
        else
            log_error "Failed to make a copy of previous environment file: '$bak_file'"
            return 1
        fi
    fi

    log "Creating restic environment file: ${Cyan}$RESTIC_ENV${COff}"

    ensure_path_exists "$(dirname "$RESTIC_ENV")" || return 1
    cp -f "$temp_env" "$RESTIC_ENV" && chmod 600 "$RESTIC_ENV" || {
        log_error "Failed to create restic environment file: '$RESTIC_ENV'"
        return 1
    }
}

restic_init_repository() {
    log_header "Initializing restic repository"

    local temp_env
    temp_env=$(mktemp)

    local return_code=0
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_init_env "$temp_env" || return 1

        if [ -z "$RESTIC_HOST" ]; then
            save_env RESTIC_HOST "$HOSTNAME" "$temp_env"
        fi

        if [ -z "$RESTIC_REPOSITORY" ]; then
            log_error "Variable RESTIC_REPOSITORY is required but was not provided"
            return 1
        elif [ -d "$RESTIC_REPOSITORY" ]; then
            # Make sure it is saved as a full path
            local full_path
            full_path="$(readlink -f "$RESTIC_REPOSITORY")"
            if [ "$full_path" != "$RESTIC_REPOSITORY" ]; then
                save_env RESTIC_REPOSITORY "" "$temp_env"
            fi
        fi

        if [ -z "$RESTIC_PASSWORD" ]; then
            log_warn "A recovery password was not specified. A new one will be been generated for you."
            save_env_id RESTIC_PASSWORD -l 32 -f "$temp_env"
            log "Recovery password: ${BIPurple}$RESTIC_PASSWORD${COff}"
            log "Please store this password in a safe place NOW. Press any key to continue..."
            read -n 1 -s -r
            log
        fi

        if restic -e "$temp_env" stats >/dev/null 2>&1; then
            log "\nExisting repository found at: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
            log_warn "An existing repository was found at this location and will be reused for future snapshots."
        else
            log "\nInitializing repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
            restic -e "$temp_env" init -q || {
                log_error "Failed to initialize backup repository"
                return 1
            }
        fi

        restic_copy_env "$temp_env"

        local password_file="${SECRETS_PATH%/}/restic_password"
        log "Saving restic password to ${Cyan}$password_file${COff}"
        printf "%s" "$RESTIC_PASSWORD" > "$password_file" && 
            chmod 600 "$password_file" || {
                log_error "Failed to save restic password to '$password_file'"
                return 1
            }
    ) || return_code=1

    rm "$temp_env"
    return $return_code
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
        printf "$RESTIC_DATA_ROOT"'/%s\n' "${BACKUP_FILTER_EXCLUDE[@]/#\//}" > "$RESTIC_CONFIG/file_exclude.txt"

        if [ "$BACKUP_KEEP" = true ]; then var_args+=(--tag keep); fi

        log "Creating new snapshot in repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic -v "$mappings" \
            -m "${PROJECT_PATH%/}/deployment.json" \
            backup \
            --tag "$COMPOSE_PROJECT_NAME" \
            --tag "$PROJECT_VERSION" \
            --exclude-file /config/file_exclude.txt \
            "${var_args[@]}" \
            "$RESTIC_DATA_ROOT" || {
                log_error "Backup operation failed"
                return 1
            }
        log
    ); exit_code=$?

    rm -rf "$RESTIC_CONFIG" > /dev/null 2>&1
    return $exit_code
}

restic_show_stats() {
    local -a opts=()
    if [ "$JSON_OUT" = true ]; then opts+=("--json"); fi

    local output
    output=$(
        restic_load_env || return 1
        restic stats --mode raw-data "${opts[@]}"
    ) || return 1

    if [ "$JSON_OUT" = true ]; then
        output=$(json_snake_to_camel "$output")
        JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --argjson stats "$output" '.backup.stats = $stats')
    else
        log_header "Repository Statistics"
        log "$output"
    fi
}

restic_list_snapshots() {
    local output
    # Using a subshell to isolate code with access to restic ENV values
    output=$(
        restic_load_env || return 1

        local -a opts=()
        local output

        if [ -n "$SNAPSHOT_ID" ]; then opts+=("$SNAPSHOT_ID"); fi
        if [ "$JSON_OUT" = true ]; then opts+=("--json"); fi

        log "Listing snapshots in repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic snapshots "${opts[@]}" \
            --tag "$COMPOSE_PROJECT_NAME" || {
                log_error "Snapshots operation failed"
                return 1
            }
    ) || return 1

    if [ "$JSON_OUT" = true ]; then
        output=$(json_snake_to_camel "$output")
        JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq -c --argjson snapshots "$output" '.backup.snapshots = $snapshots')
    else
        log "$output"
        log
    fi

}

restic_browse_snapshot() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        log "Browsing snapshot ${Purple}$SNAPSHOT_ID${COff} in repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        local recursive=""
        if [ "$SNAPSHOT_BROWSE_RECURSIVE" = true ]; then 
            recursive="--recursive"
        fi
        restic ls "$SNAPSHOT_ID" "${SNAPSHOT_BROWSE_FLAGS[@]}" || {
            log_error "Browse operation failed"
            return 1
        }

        log
    ) || return 1
}

restic_forget_snapshots() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        log "Deleting snapshot ${Purple}$SNAPSHOT_ID${COff} from repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        local output
        output=$(restic forget "$SNAPSHOT_ID" || {
                log_error "Forget operation failed"
                return 1
            })

        log "$output"
        log
    ) || return 1
}

restic_dump_file() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        restic_load_env || return 1

        log "Retrieving file ${Purple}$1${COff} from repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic dump "$SNAPSHOT_ID" "$RESTIC_DATA_ROOT/${1#/}" || {
            log_error "Forget operation failed"
            return 1
        }

        log
    ) || return 1
}

restic_run_restore() {
    # Using a subshell to isolate code with access to restic ENV values
    (
        local mappings

        restic_load_env || return 1

        mappings=$(IFS=":"; echo "${BACKUP_FILTER_INCLUDE[*]}")

        log "Restoring snapshot ${Purple}$SNAPSHOT_ID${COff} from repository: ${Cyan}${RESTIC_REPOSITORY}${COff}\n"
        restic -v "$mappings" \
            restore "$SNAPSHOT_ID" \
            --target / || {
                log_error "Backup operation failed"
                return 1
            }
        log
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

BACKUP_SERVICES_STOPPED=false

backup_stop_services() {
    if [[ -n "${BACKUP_SERVICES[*]}" && "$DRY_RUN" != true ]]; then
        log "Stopping docker services ..."
        # shellcheck disable=SC2048,SC2086
        docker compose -p "$COMPOSE_PROJECT_NAME" stop ${BACKUP_SERVICES[*]} || {
            log_error "Failed to stop docker services in preparation for backup. Some services may need to be restarted manually."
            return 1
        }
        BACKUP_SERVICES_STOPPED=true
    fi
}

backup_start_services() {
    if [[ "$BACKUP_SERVICES_STOPPED" = true && -n "${BACKUP_SERVICES[*]}" && "$DRY_RUN" != true ]]; then
        log "Starting docker services ..."
        # shellcheck disable=SC2048,SC2086
        docker compose -p "$COMPOSE_PROJECT_NAME" start ${BACKUP_SERVICES[*]} || {
            log_warn "Failed to restart docker services after backup. Some services may need to be restarted manually."
            return 1
        }
    fi
}

################################################################################
#                                 SCHEDULE STEPS

backup_configure_enabled() {
    if [ "$BACKUP_ENABLED_CHANGE" = true ]; then
    (
        #Running in a subshell to avoid polluting environment with restic variables
        restic_load_env || return 1
        if [ -z "$RESTIC_REPOSITORY" ]; then
            log_error "The value for RESTIC_REPOSITORY is missing from '$RESTIC_ENV'"
            return 1
        fi
        if [ -z "$RESTIC_PASSWORD" ]; then
            log_error "The value for RESTIC_PASSWORD is missing from '$RESTIC_ENV'"
            return 1
        fi
        if ! restic snapshots >/dev/null 2>&1; then
            log_error "The repository at ${Cyan}$RESTIC_REPOSITORY${COff} does not appear to be available"
            return 1
        fi
    ) || return 1
    fi
    save_env BACKUP_ENABLED "$BACKUP_ENABLED_CHANGE"
}

backup_configure_schedule() {
    local result
    result=$(validate_cron_regex "$BACKUP_SCHEDULE_CHANGE") || {
        log_error "The schedule cron expression is invalid. $result"
        return 1
    }
    save_env BACKUP_SCHEDULE "'$BACKUP_SCHEDULE_CHANGE'"
}

backup_configure_retention() {
    local result
    result=$(validate_retention_policy "$BACKUP_RETENTION_POLICY_CHANGE") || {
        log_error "The retention policy expression is invalid. $result"
        return 1
    }
    if [ "$BACKUP_RETENTION_POLICY_CHANGE" = "all" ]; then
        save_env BACKUP_ENABLE_FORGET false
    else
        save_env BACKUP_ENABLE_FORGET true
        save_env BACKUP_RETENTION_POLICY "$BACKUP_RETENTION_POLICY_CHANGE"
    fi
}

backup_schedule_info() {
    log_header "Scheduled Backup Configuration"
    log "Background backups:    $([ "$BACKUP_ENABLED" == true ] && echo "enabled" || echo "disabled")"
    log "Backup schedule:       ${BACKUP_SCHEDULE:-"(Not set)"}"
    log "Retention policy:      ${BACKUP_RETENTION_POLICY:-"(Not set)"}"

    if [ "$JSON_OUT" = true ]; then
        JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq -c \
            --argjson enabled "$([ "$BACKUP_ENABLED" == true ] && echo "true" || echo "false")" \
            --arg cron "$BACKUP_SCHEDULE" \
            --arg retention "$BACKUP_RETENTION_POLICY" '
            .backup.schedule.enabled=$enabled |
            .backup.schedule.cron=$cron |
            .backup.schedule.retention=$retention
        ')
    fi
}

################################################################################
#                                 RESTORE STEPS

restore_check_installed() {
    if [[ "${#INSTALLED_MODULES[@]}" -gt 0 ]]; then
        log_warn "There are ${#INSTALLED_MODULES[@]} modules already installed."
        log "This operation will destroy and recreate Docker resources for these modules."
        ask_confirmation || return 1
    fi
}

restore_configure_local() {
    if [ -n "$APPDATA_LOCATION" ]; then
        # Copy the .env file used on last deployment
        local restore_env="${APPDATA_LOCATION%/}/project/${COMPOSE_PROJECT_NAME}/.env"
        log "Restoring environment from file ${Cyan}$restore_env${COff}"
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
    log "Extracting snapshot manifest to ${Cyan}$deployment_file${COff}"
    restic_dump_file "/manifest.json" > "$deployment_file" || {
        log_error "Failed to load remote deployment file"
        return 1
    }

    log "Loading snapshot manifest"
    load_deployment_file "$deployment_file" || return 1
    log

    ensure_path_exists "$APPDATA_LOCATION" || return 1

    local target_folder
    for target_folder in "${BACKUP_FILTER_INCLUDE[@]}"; do
        ensure_path_exists "$target_folder" || return 1
    done
    log

    log "Running restic restore operation. This operation could take several minutes..."
    restic_run_restore || return 1
    log
}