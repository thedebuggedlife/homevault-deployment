#!/bin/bash

set -o pipefail

PROJECT_VERSION=0.1
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="${PROJECT_ROOT%/}"

source "$PROJECT_ROOT/lib/logging.sh"
source "$PROJECT_ROOT/lib/config.sh"
source "$PROJECT_ROOT/lib/smtp2go.sh"
source "$PROJECT_ROOT/lib/docker.sh"
source "$PROJECT_ROOT/lib/backup.sh"

SELECTED_ACTION=
SHOW_ALL=false
COMPOSE_PATH=
SECRETS_PATH=
OVERRIDE_COMPOSE=true
OVERRIDE_VERSIONS=false
UNATTENDED=
NO_DOWNLOAD=
USE_SMTP2GO=true
USE_DEFAULTS=true
ENV_FILE=.env
AS_USER="$USER"
REINSTALL_FROM=
COMPOSE_PROJECT_NAME=homevault
COMPOSE_OPTIONS=
COMPOSE_UP_OPTIONS=

# Administrator account
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_EMAIL=
ADMIN_DISPLAY_NAME=

# Global ENV variables
APPDATA_LOCATION=
# shellcheck disable=SC2034
TAILSCALE_IP=
CF_DOMAIN_NAME=

# Base module should always be first in the list
declare -a ENABLED_MODULES=("base")
declare -a INSTALLED_MODULES=()
declare -a REMOVE_MODULES=()

################################################################################
#                           SETUP MODULES

declare -a CONFIG_ENV_HOOKS=()
declare -a CONFIG_SECRETS_HOOKS=()
declare -a COMPOSE_EXTRA_HOOKS=()
declare -a PRE_INSTALL_HOOKS=()
declare -a POST_INSTALL_HOOKS=()
declare -a BOOTSTRAP_HOOKS=()
declare -A MODULE_OPTIONS

dedup_modules() {
    local -A seen_modules
    local unique_modules=()

    # First, ensure "base" is always present and in first position
    unique_modules+=("base")
    seen_modules["base"]=1

    for module in "${ENABLED_MODULES[@]}"; do
        if [[ -z "${seen_modules[$module]}" ]]; then
            unique_modules+=("$module")
            seen_modules[$module]=1
        fi
    done

    ENABLED_MODULES=("${unique_modules[@]}")
}

load_modules() {
    log_header "Loading enabled modules"
    dedup_modules
    for module in "${ENABLED_MODULES[@]}"; do
        echo -e "Loading module ${Purple}$module${COff}"
        local module_setup="$PROJECT_ROOT/modules/$module/setup.sh"
        if [ -f "$module_setup" ]; then
            # shellcheck source=/dev/null
            source "$module_setup"
        else
            log_error "Module '$module' is invalid. Use --help flag to see a list of supported modules"
            exit 1
        fi
    done
}

###
# Function to execute all hooks in a given array
#
# Example: 
#   execute_hooks POST_INSTALL_HOOKS[@] "post-install"
#
# @param $hook_array    The hooks to execute
# @param $hook_name     The name of the hook (for logging)
# @return void
###
execute_hooks() {
    local hook_name="${!#}"  # Get the last argument (hook name)
    local -a hooks=("${@:1:$#-1}")  # Get all arguments except the last one
    
    echo -e "\nExecuting ${Purple}$hook_name${COff} hooks...\n" >&2
    for hook in "${hooks[@]}"; do
        if ! $hook; then
            log_error "Hook '$hook' failed"
            exit 1
        fi
    done
}

###
# Combine environment files from enabled modules
#
# @return void
###
prepare_env_file() {
    local env_exists
    env_exists=$([ -f "$ENV_FILE" ] && echo true || echo false)
    if [ "$env_exists" != "true" ]; then
        echo -e "Creating environment file ${Cyan}$ENV_FILE${COff}"
    fi
    for module in "${ENABLED_MODULES[@]}"; do
        local module_env="$PROJECT_ROOT/modules/$module/.env"
        if [ -s "$module_env" ]; then
            while IFS= read -r line || [ -n "$line" ]; do
                # Skip comments and empty lines
                if [[ ! "$line" =~ ^[[:space:]]*# && -n "$line" ]]; then
                    # Extract key from line, everything before first =
                    key="${line%%=*}"
                    if [[ -n "$key" && "$line" == *"="* ]]; then
                        # If key does not already exist in root .env file, append the line
                        if [[ ! -f "$ENV_FILE" ]] || ! grep -q "^${key}=" "$ENV_FILE"; then
                            append_file "$line" "$ENV_FILE"
                            if [ "$env_exists" = "true" ]; then
                                # Only log line by line if .env file already existed
                                echo -e "Updated ${Purple}$key${COff} in ${Cyan}$ENV_FILE${COff}."
                            fi
                        fi
                    fi
                fi
            done < "$module_env"
        fi
    done
    # shellcheck source=/dev/null
    source "$ENV_FILE"
}

###
# Download application data for all enabled modules
#
# @return void
###
download_appdata() {
    for module in "${ENABLED_MODULES[@]}"; do
        download_module_appdata "$module"
    done
}

load_module_help() {
    for module_file in "$PROJECT_ROOT"/modules/*/help.txt; do
        module_name=$(basename "$(dirname "$module_file")")
        #shellcheck disable=SC2034
        MODULE_OPTIONS["$module_name"]=$(cat "$module_file")
    done
}

find_all_modules() {
    for module_file in "$PROJECT_ROOT"/modules/*/setup.sh; do
        module_name=$(basename "$(dirname "$module_file")")
        if [ "$module_name" != "base" ]; then
            ENABLED_MODULES+=("$module_name")
        fi
    done
}

find_installed_modules() {
    log_header "Looking for installed modules"

    if [ "$_DOCKER_INSTALLED" != "true" ]; then return 0; fi

    local container_ids container_id container_labels module_name
    container_ids=$(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME")

    for container_id in $container_ids; do
        container_labels=$(docker inspect --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{printf "\n"}}{{end}}' "$container_id")
        
        # Find labels matching the pattern selfhost.module.XX=1
        while IFS= read -r label; do
            if [[ "$label" =~ ^selfhost\.module\.(.+)=1$ ]]; then
                module_name="${BASH_REMATCH[1]}"
                INSTALLED_MODULES+=("$module_name")
            fi
        done <<< "$container_labels"
    done

    if [ ${#INSTALLED_MODULES[@]} -eq 0 ]; then
        echo "There are no modules installed."
        return 0
    fi

    # Remove duplicates from the array
    mapfile -t INSTALLED_MODULES < <(printf "%s\n" "${INSTALLED_MODULES[@]}" | sort -u)

    local module
    for module in "${INSTALLED_MODULES[@]}"; do
        echo -e "Found installed module: ${Purple}$module${COff}"
        # Enable all installed modules except those marked for removal
        array_contains "$module" "${REMOVE_MODULES[@]}" || ENABLED_MODULES+=("$module")
    done

    dedup_modules
}

find_missing_modules() {
    # Find modules that are installed but not enabled
    local -a missing_modules=()
    local module
    for module in "${INSTALLED_MODULES[@]}"; do
        # shellcheck disable=SC2076
        if [[ ! " ${ENABLED_MODULES[*]} " =~ " ${module} " ]]; then
            missing_modules+=("$module")
        fi
    done

    if [ ${#missing_modules[@]} -gt 0 ]; then
        log_warn "Some modules will be removed by this operation. Please read the following carefully."
        echo "The following modules are installed but were not included in this run:"
        printf "  - %s\n" "${missing_modules[@]}"
        echo -e "\nIf this was unintentional, exit and re-run the script, including them with the -m option."
        echo
        local user_input
        read -p "Do you want to proceed? [y/N] " user_input </dev/tty
        user_input=${user_input:-N}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
            abort_install
        fi
    fi
}

################################################################################
#                            CONFIGURATION STEPS

###
# Create the application data folder (which is mounted into Docker)
#
# @return void
###
create_data_locations() {
    ensure_path_exists "$APPDATA_LOCATION"
    ensure_path_exists "$SECRETS_PATH"
}

###
# Ask for any variables that aren't yet defined in the .env file
#
# @return void
###
ask_for_variables() {
    execute_hooks "${CONFIG_ENV_HOOKS[@]}" "config-env"
    SECRETS_PATH="${APPDATA_LOCATION%/}/secrets/"
    COMPOSE_PATH="${APPDATA_LOCATION%/}/compose/$COMPOSE_PROJECT_NAME/"
}

###
# Create any missing secret files
#
# @return void
###
save_secrets() {
    execute_hooks "${CONFIG_SECRETS_HOOKS[@]}" "config-secrets"
    if ! chmod 644 "${SECRETS_PATH}"*; then
        return 1
    fi
}

###
# Deploy services via docker compose
#
# @return void
###
deploy_project() {
    COMPOSE_OPTIONS="-p '$COMPOSE_PROJECT_NAME' --env-file '$ENV_FILE' $COMPOSE_OPTIONS"
    COMPOSE_UP_OPTIONS="-d -y --remove-orphans --quiet-pull --wait $COMPOSE_UP_OPTIONS"

    ensure_path_exists "${COMPOSE_PATH%/}/"
    if [ "$OVERRIDE_COMPOSE" = true ]; then
        rm -rf "${COMPOSE_PATH:?}/"* || {
            log_error "Failed to delete previous compose files"
            exit 1
        }
    fi

    # Copy the ENV file to include in backup/restore - always override existing file
    cp -f "$ENV_FILE" "${COMPOSE_PATH%/}/.env"

    # Grab the default "docker-compose.yml" file for each module
    local -a original_files=()
    local -a project_files=()
    for module in "${ENABLED_MODULES[@]}"; do
        local default_file="${PROJECT_ROOT%/}/modules/$module/docker-compose.yml"
        if [ -f "$default_file" ]; then
            original_files+=("$module:$default_file")
        fi
    done

    # Collect any additional files provided by the enabled modules
    readarray -t extra_files < <(execute_hooks  "${COMPOSE_EXTRA_HOOKS[@]}" "compose-extra")
    original_files+=("${extra_files[@]}")

    # Copy the files to match the following file layout: 
    # "{APPDATA_LOCATION}/compose/{PROJECT}/{module}/docker-compose[.{extra}].yml"
    for original_file in "${original_files[@]}"; do
        local project_file target_project inner
        # Original file format "<source_module>:<full_path>[:<target_module>]"
        IFS=':' read -r module original_file inner <<< "$original_file"
        if [ -z "$inner" ]; then
            target_project="$module"
            project_file="${COMPOSE_PATH%/}/$module/$(basename "$original_file")"
        else
            printf '%s\n' "${ENABLED_MODULES[@]}" | grep -q "^$inner$" || continue
            target_project="$inner ($module)"
            project_file="${COMPOSE_PATH%/}/$inner/docker-compose.$module.yml"
        fi
        if [ -f "$original_file" ]; then
            # Copy docker-compose files only if they do not currently exist under appdata (unless overridden)
            # This is important because, the files in appdata may be modified during container-update operations
            if [[ -f "$project_file" ]]; then
                echo -e "Using existing compose file: ${Cyan}$project_file${COff}"
            else
                echo -e "Copying docker compose file for ${Purple}$target_project${COff} to ${Cyan}$project_file${COff}"
                ensure_path_exists "$( dirname "$project_file" )"
                (cp -f "$original_file" "$project_file") || {
                    log_error "Failed to copy docker compose file for '$target_project'"
                    exit 1
                }
            fi
        fi
        if [ -f "$project_file" ]; then
            project_files+=("$project_file")
            COMPOSE_OPTIONS="$COMPOSE_OPTIONS -f '$project_file'"
        fi
    done

    echo

    if [ "$OVERRIDE_VERSIONS" != true ]; then
        if ! compose_match_container_versions "$COMPOSE_PROJECT_NAME" "${project_files[@]}"; then
            log_error "Failed to match existing container versions in compose project files"
            exit 1
        fi
    fi

    local user_input=Y
    if [ "$UNATTENDED" != true ]; then
        echo -en "\n\nProject ${Purple}$COMPOSE_PROJECT_NAME${COff} is ready for docker deployment. "
        read -p "Do you want to proceed? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
    fi
    if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
        abort_install
    fi

    execute_hooks "${PRE_INSTALL_HOOKS[@]}" "pre-install"

    log_header "Deploying services"

    echo -e "Deploying project ${Purple}$COMPOSE_PROJECT_NAME${COff}..."
    if ! sg docker -c "docker compose $COMPOSE_OPTIONS up $COMPOSE_UP_OPTIONS"; then
        log_error "Docker Compose deployment failed"
        exit 1
    fi

    execute_hooks "${POST_INSTALL_HOOKS[@]}" "post-install"
}

###
# Create the variables with values for server administrator account and save
# them to the file used for LLDAP bootstrap
#
# Options:
#   -l      Load only, do not save to file (for post-install steps only)
#
# @return void
###
configure_admin_account() {
    local config_file="${APPDATA_LOCATION%/}/lldap/bootstrap/user-configs/admin.json"
    local load_only=false
    OPTIND=1
    while getopts ":l" opt; do
        case $opt in
            l) load_only=true ;;
            \?) log_warn "Invalid option: -$OPTARG" ;;
        esac
    done

    # Apply any overrides passed via -o flag
    ADMIN_USERNAME="${ADMIN_USERNAME_OVERRIDE}"
    ADMIN_EMAIL="${ADMIN_EMAIL_OVERRIDE}"
    ADMIN_PASSWORD="${ADMIN_PASSWORD_OVERRIDE}"
    ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME_OVERRIDE}"

    local save_file=false
    if [[ -n "$ADMIN_USERNAME" || -n "$ADMIN_EMAIL" || -n "$ADMIN_PASSWORD" || -n "$ADMIN_DISPLAY_NAME" ]]; then
        save_file=true
    fi

    # Read missing values from file (if it exists)
    if [[ -f "$config_file" ]]; then
        ADMIN_USERNAME=${ADMIN_USERNAME:-"$(jq -r '.id' "$config_file")"}
        ADMIN_EMAIL=${ADMIN_EMAIL:-"$(jq -r '.email' "$config_file")"}
        ADMIN_PASSWORD=${ADMIN_PASSWORD:-"$(jq -r '.password' "$config_file")"}
        ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME:-"$(jq -r '.displayName' "$config_file")"}
    fi

    # If already configured and the --resume flag was specified, skip the rest
    if [[ -z "$ADMIN_USERNAME" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" || -z "$ADMIN_DISPLAY_NAME" || "$USE_DEFAULTS" != "true" ]]; then

        echo -e "The following user will be created and configured with ${Yellow}administrator privileges${COff} across all applications."
        echo

        ADMIN_USERNAME=$(ask_value "Username" -d "$ADMIN_USERNAME")
        ADMIN_EMAIL=$(ask_value "Email address" -d "$ADMIN_EMAIL")
        while true; do
            local confirm_pass
            ADMIN_PASSWORD=$(ask_value "Password" -m)
            confirm_pass=$(ask_value "Confirm password" -m)
            if [ "$ADMIN_PASSWORD" != "$confirm_pass" ]; then
                log_warn "Passwords do not match. Please try again."
            else
                break
            fi
        done
        ADMIN_DISPLAY_NAME=$(ask_value "Display name (e.g. <First> <Last>)" -d "$ADMIN_DISPLAY_NAME")
        save_file=true
    fi

    if [ "$load_only" = "true" ]; then 
        save_env ADMIN_EMAIL "$ADMIN_EMAIL"
        return 0
    fi

    if [ "$save_file" = "true" ]; then
        local json
        if ! json=$( [ -s "$config_file" ] && cat "$config_file" || echo "{}" ); then
            log_error "Failed to read JSON for server administrator"
            exit 1
        fi
        if ! json=$(echo "$json" | jq \
            --arg id "$ADMIN_USERNAME" \
            --arg email "$ADMIN_EMAIL" \
            --arg password "$ADMIN_PASSWORD" \
            --arg displayName "$ADMIN_DISPLAY_NAME" '
            .id = $id |
            .email = $email |
            .password = $password |
            .displayName = $displayName
        '); then
            log_error "Failed to update JSON for server administrator"
            exit 1
        fi
        write_file "$json" "$config_file"
    fi

    save_env ADMIN_EMAIL "$ADMIN_EMAIL"
    write_file "$ADMIN_USERNAME" "${SECRETS_PATH}server_admin_username"
    write_file "$ADMIN_PASSWORD" "${SECRETS_PATH}server_admin_password"
}

configure_restore() {
    log_header "Preparing to restore project"

    if [[ "${#INSTALLED_MODULES[@]}" -gt 0 ]]; then
        echo -e "${Yellow}There are ${Purple}${#INSTALLED_MODULES[@]}${Yellow} already installed.${COff}"
        echo -e "${Yellow}This operation will destroy and recreate Docker resources for these modules.${COff}"
        echo
        if ! ask_confirmation; then abort_install; fi
    fi

    if [ -z "$APPDATA_LOCATION" ]; then
        log_error "Missing appdata location to restore from."
        exit 1;
    fi

    COMPOSE_PATH="${APPDATA_LOCATION%/}/compose/${COMPOSE_PROJECT_NAME}"

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

    load_restore_file "${COMPOSE_PATH%/}/.restore.json" || exit 1
}

cmd=( "$@" )

build_resume_command() {
    local resume="$PROJECT_ROOT/resume.sh"
    # Reconstruct the command as a string with proper quoting
    {
        # shellcheck disable=SC2016
        echo 'rm ${BASH_SOURCE[0]}'
        echo "cd '$PROJECT_ROOT'"
        printf "%q" "./setup.sh"
        printf " %q" "${cmd[@]}"
    } > "$resume"
    chmod +x "$resume"
}

# Terminate program
abort_install() {
    log_warn "Setup aborted by user."
    build_resume_command
    echo -e "To resume, run: ${BIGreen}${PROJECT_ROOT}/resume.sh${COff}\n"
    exit 1
}

print_usage() {
    echo -e "\nUsage: $0 [global options] <action> [action options]"

    if [ -z "$SELECTED_ACTION" ]; then
        echo -e "\nActions:\n"
        echo "  deploy      Installs and/or updates modules in the project."
        echo "  backup      Creates a new snapshot with the current statue of the project."
        echo "  restore     Recovers the state of the project from a previous snapshot."
        echo "  modules     Shows information about installed or available modules."
        echo -e "\nTo display help for an action:\n"
        echo "  $0 <action> --help"

    elif [ "$SELECTED_ACTION" = "deploy" ]; then
        echo -e "\nDeploy options:\n"
        echo "  -m, --module <module>           Includes the given module in the project. Can be specified multiple times."
        echo "      --module all                Enables all available modules."
        echo -e "  --rm <module>                   Removes a module that had been previously installed. ${IRed}Use with caution!${COff}" 
        echo "  -o, --override <var>=<value>    Override environment variable. Can be specified multiple times."
        echo "  --no-download                   Do not download appdata from GitHub. Only use if appdata was previously downloaded."
        echo -e "  --keep-compose                  Do not override previously deployed docker-compose files. ${IRed}Use with caution!${COff}"
        echo -e "  --override-versions             Override running versions with those specified in compose files. ${IRed}Use with caution!${COff}"
        echo "  --custom-smtp                   Do not use SMTP2GO for sending email (custom SMTP configuration required)."
        echo "  --dry-run                       Execute Docker Compose in dry run mode."

    elif [ "$SELECTED_ACTION" = "restore" ]; then
        echo -e "\nRestore options:\n"
        echo "  --from <path>                   Look for existing appdata at this location."

    elif [ "$SELECTED_ACTION" = "modules" ]; then
        echo -e "\Modules options:\n"
        echo "  --all                           Show information for all modules available. Otherwise only installed modules are shown."
    fi

    echo -e "\nGlobal options:\n"
    echo "  -h, --help                      Display this help message."
    echo "  -u, --user <user>               User to apply for file permissions. [Default: '$USER']"
    echo "  --always-ask                    Force interactive prompts for settings with a default or previously provided."
    echo "  --unattended                    Do not stop for any prompt. Safe prompts will be auto-accepted. Other prompts will end in failure."

    exit 1
}

show_modules() {
    if [ "$SHOW_ALL" = true ]; then
        load_module_help
        echo -e "\nAvailable modules:\n"
        log_options MODULE_OPTIONS true
    else
        find_installed_modules
        echo
    fi

    exit 0
}

check_action_for_option() {
    local action=$1
    local option=$2
    if [ -z "$SELECTED_ACTION" ]; then
        log_invalid "$option is not a global option"
        print_usage
    elif [ "$SELECTED_ACTION" != "$action" ]; then
        log_invalid "$option is not supported for action: $SELECTED_ACTION"
        print_usage
    fi
}

parse_command_line() {
    while [ "$#" -gt 0 ]; do
        case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        ## ACTIONS
        deploy)
            if [ -n "$SELECTED_ACTION" ]; then log_invalid "Only 1 action can be selected at a time"; exit 1; fi
            SELECTED_ACTION="deploy"
            shift 1
            ;;
        backup)
            if [ -n "$SELECTED_ACTION" ]; then log_invalid "Only 1 action can be selected at a time"; exit 1; fi
            SELECTED_ACTION="backup"
            shift 1
            ;;
        restore)
            if [ -n "$SELECTED_ACTION" ]; then log_invalid "Only 1 action can be selected at a time"; exit 1; fi
            SELECTED_ACTION="restore"
            shift 1
            ;;
        modules)
            if [ -n "$SELECTED_ACTION" ]; then log_invalid "Only 1 action can be selected at a time"; exit 1; fi
            SELECTED_ACTION="modules"
            shift 1
            ;;
        ## GLOBAL OPTIONS
        --user | -u)
            if [ -n "$2" ]; then
                AS_USER="$2"
                shift 2
                continue
            else
                log_invalid "$1 requires a value."
                exit 1
            fi
            ;;
        --unattended)
            UNATTENDED=true
            USE_DEFAULTS=true
            shift 1
            continue
            ;;
        --always-ask)
            USE_DEFAULTS=false
            shift 1
            continue
            ;;
        -h | --help)
            print_usage
            ;;
        ## DEPLOY OPTIONS
        --override | -o)
            check_action_for_option deploy "$1"
            if [ -n "$2" ]; then
                # Parse override in form of: VARIABLE_NAME=VALUE
                if echo "$2" | grep -q '='; then
                    eval "$(echo "$2" | cut -d '=' -f 1)_OVERRIDE=\"$(echo "$2" | cut -d '=' -f 2-)\""
                else
                    log_invalid "$1 requires an assignment in the form VARIABLE_NAME=VALUE."
                    exit 1
                fi
                shift 2
                continue
            else
                log_invalid "$1 requires an assignment in the form VARIABLE_NAME=VALUE."
                exit 1
            fi
            ;;
        --module | -m)
            check_action_for_option deploy "$1"
            if [ -n "$2" ]; then
                if [ "$2" = "all" ]; then 
                    find_all_modules
                else
                    ENABLED_MODULES+=("$2")
                fi
                dedup_modules
                shift 2
                continue
            else
                log_invalid "$1 requires a value."
                exit 1
            fi
            ;;
        --rm)
            check_action_for_option deploy "$1"
            if [ -n "$2" ]; then
                REMOVE_MODULES+=("$2")
                shift 2
                continue
            else
                log_invalid "$1 requires a value."
                exit 1
            fi
            ;;
        --keep-compose)
            check_action_for_option deploy "$1"
            OVERRIDE_COMPOSE=false
            shift 1
            continue
            ;;
        --override-versions)
            check_action_for_option deploy "$1"
            OVERRIDE_VERSIONS=true
            shift 1
            continue
            ;;
        --custom-smtp)
            check_action_for_option deploy "$1"
            USE_SMTP2GO=false
            shift 1
            continue
            ;;
        --no-download)
            check_action_for_option deploy "$1"
            NO_DOWNLOAD=true
            shift 1
            continue
            ;;
        --dry-run)
            check_action_for_option deploy "$1"
            COMPOSE_UP_OPTIONS="$COMPOSE_UP_OPTIONS --dry-run"
            shift 1
            continue
            ;;
        ## BACKUP OPTIONS
        ## RESTORE OPTIONS
        --from)
            check_action_for_option restore "$1"
            if [ -n "$2" ]; then
                APPDATA_LOCATION="$2"
                shift 2
                continue
            else
                log_invalid "$1 requires a value."
                exit 1
            fi
            ;;
        ## MODULE OPTIONS
        --all)
            check_action_for_option modules "$1"
            SHOW_ALL=true
            shift 1
            continue
            ;;
        *)
            log_invalid "Unknown option: $1"
            print_usage
            ;;
        esac
    done

    if [ -z "$SELECTED_ACTION" ]; then
        log_invalid "Missing action parameter"
        print_usage
    fi
}

################################################################################
#                           MAIN PROGRAM LOGIC

trap "echo && abort_install" SIGINT

parse_command_line "$@"

if [ "$SELECTED_ACTION" = "modules" ]; then
    show_modules
fi

find_installed_modules

if [ "$SELECTED_ACTION" = "restore" ]; then
    configure_restore
fi

load_modules

log_header "Configuring Docker"
configure_docker

log_header "Preparing environment files"

if ! prepare_env_file; then
    log_error "Failed to prepare '$ENV_FILE'."
    exit 1
fi

ask_for_variables

log_header "Preparing application data folder"
create_data_locations

if [ "$NO_DOWNLOAD" != true ]; then
    download_appdata
fi

log_header "Server administrator account"
configure_admin_account

log_header "Configuring Tailscale"
configure_tailscale

# Configuring CF tunnel requires that $SECRETS_LOCATION has already been created
log_header "Configuring CloudFlare Tunnel"
configure_cloudflare_tunnel

if [[ "$USE_SMTP2GO" = "true" ]]; then
    log_header "Configuring SMTP2GO Account"
    configure_smtp2go
fi

log_header "Preparing secret files"

save_secrets

find_missing_modules

deploy_project

execute_hooks "${BOOTSTRAP_HOOKS[@]}" "bootstrap"

log_header "Finalizing deployment"

save_restore_file "${COMPOSE_PATH%/}/.restore.json" || exit 1

log_done