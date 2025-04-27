#!/bin/bash

set -o pipefail

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="${PROJECT_ROOT%/}"

source "$PROJECT_ROOT/lib/logging.sh"
source "$PROJECT_ROOT/lib/config.sh"
source "$PROJECT_ROOT/lib/smtp2go.sh"
source "$PROJECT_ROOT/lib/docker.sh"

COMPOSE_PATH=
SECRETS_PATH=
OVERRIDE_COMPOSE=false
OVERRIDE_VERSIONS=false
UNATTENDED=
NO_DOWNLOAD=
USE_SMTP2GO=true
POST_INSTALL=
RESUME=false
ENV_FILE=.env
AS_USER="$USER"
COMPOSE_PROJECT_NAME=self-host
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
declare -a INSTALLED_MODULES

################################################################################
#                           SETUP MODULES

declare -a CONFIG_ENV_HOOKS=()
declare -a CONFIG_SECRETS_HOOKS=()
declare -a PRE_INSTALL_HOOKS=()
declare -a POST_INSTALL_HOOKS=()
declare -a BOOTSTRAP_HOOKS=()
declare -A MODULE_OPTIONS

dedup_modules() {
    local -A seen_modules
    local unique_modules=()
    for module in "${ENABLED_MODULES[@]}"; do
        if [[ -z "${seen_modules[$module]}" ]]; then
            unique_modules+=("$module")
            seen_modules[$module]=1
        fi
    done
    ENABLED_MODULES=("${unique_modules[@]}")
}

load_modules() {
    dedup_modules
    for module in "${ENABLED_MODULES[@]}"; do
        local module_setup="$PROJECT_ROOT/modules/$module/setup.sh"
        if [ -s "$module_setup" ]; then
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
    
    echo -e "\n\nExecuting ${Purple}$hook_name${COff} hooks..."

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

find_modules() {
    for module_file in "$PROJECT_ROOT"/modules/*/setup.sh; do
        module_name=$(basename "$(dirname "$module_file")")
        if [ "$module_name" != "base" ]; then
            ENABLED_MODULES+=("$module_name")
        fi
    done
}

find_missing_modules() {
    local container_ids container_id container_labels module_name
    container_ids=$(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME")

    INSTALLED_MODULES=()
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
        return 0
    fi

    # Remove duplicates from the array
    mapfile -t INSTALLED_MODULES < <(printf "%s\n" "${INSTALLED_MODULES[@]}" | sort -u)

    # Find modules that are installed but not enabled
    local -a missing_modules=()
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
    local user_input=Y
    if [ "$UNATTENDED" != true ]; then
        echo -en "\n\nProject ${Purple}$COMPOSE_PROJECT_NAME${COff} is ready for deployment. "
        read -p "Do you want to proceed? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
    fi
    if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
        abort_install
    fi

    echo

    COMPOSE_OPTIONS="-p '$COMPOSE_PROJECT_NAME' --env-file '$ENV_FILE' $COMPOSE_OPTIONS"
    COMPOSE_UP_OPTIONS="-d -y --remove-orphans --quiet-pull --wait $COMPOSE_UP_OPTIONS"

    # Copy the ENV file to include in backup/restore - always override existing file
    ensure_path_exists "${COMPOSE_PATH%/}/"
    cp -f "$ENV_FILE" "${COMPOSE_PATH%/}/.env"
    local -a project_files=()
    for module in "${ENABLED_MODULES[@]}"; do
        for inner in "${ENABLED_MODULES[@]}"; do
            local original_file project_file target_project
            if [ "$module" = "$inner" ]; then
                target_project="$module"
                original_file="${PROJECT_ROOT%/}/modules/$module/docker-compose.yml"
                project_file="${COMPOSE_PATH%/}/$module/docker-compose.yml"
            else
                target_project="$module ($inner)"
                original_file="${PROJECT_ROOT%/}/modules/$module/docker-compose.$inner.yml"
                project_file="${COMPOSE_PATH%/}/$inner/docker-compose.$module.yml"
            fi
            if [ -f "$original_file" ]; then
                # Copy docker-compose files only if they do not currently exist under appdata (unless overridden)
                # This is important because, the files in appdata may be modified during container-update operations
                if [[ -f "$project_file" && "$OVERRIDE_COMPOSE" != true ]]; then
                    echo -e "Using existing compose file: ${Cyan}$project_file${COff}"
                else
                    echo -e "Copying docker compose file for ${Purple}$target_project${COff} to ${Cyan}$project_file${COff}"
                    ensure_path_exists "$( dirname "$project_file" )"
                    (cp -f "$original_file" "$project_file") || {
                        log_error "Failed to copy docker compose file for '$module'"
                        exit 1
                    }
                fi
            fi
            if [ -f "$project_file" ]; then
                project_files+=("$project_file")
                COMPOSE_OPTIONS="$COMPOSE_OPTIONS -f '$project_file'"
            fi
        done
    done

    echo

    if [ "$OVERRIDE_VERSIONS" != true ]; then
        if ! compose_match_container_versions "$COMPOSE_PROJECT_NAME" "${project_files[@]}"; then
            log_error "Failed to match existing container versions in compose project files"
            exit 1
        fi
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
    while getopts ":l" opt; do
        case $opt in
            l) load_only=true ;;
            \?) log_warn "configure_admin_account: Invalid option: -$OPTARG" ;;
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
    if [[ -z "$ADMIN_USERNAME" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" || -z "$ADMIN_DISPLAY_NAME" || "$RESUME" != "true" ]]; then

        ADMIN_USERNAME=$(ask_value "Username" "$ADMIN_USERNAME" true)
        ADMIN_EMAIL=$(ask_value "Email address" "$ADMIN_EMAIL" true)
        ADMIN_PASSWORD=$(ask_value "Password" "$ADMIN_PASSWORD" true "$ADMIN_PASSWORD" true)
        ADMIN_DISPLAY_NAME=$(ask_value "Display name (e.g. <First> <Last>)" "$ADMIN_DISPLAY_NAME" true)

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

cmd=( "$0" "$@" )

build_resume_command() {
    # Check if --resume is already present in the arguments
    found_resume=false
    for arg in "${cmd[@]}"; do
        if [[ "$arg" == "--resume" ]]; then
            found_resume=true
            break
        fi
    done

    # Append --resume if it was not provided
    if ! $found_resume; then
        cmd+=( "--resume" )
    fi

    # Reconstruct the command as a string with proper quoting
    printf "%q " "${cmd[@]}" > "$PROJECT_ROOT/resume.sh"
    chmod +x "$PROJECT_ROOT/resume.sh"
    echo -e "To resume, run: ${BIGreen}${PROJECT_ROOT}/resume.sh${COff}\n"
}

# Terminate program and print instructions on how to invoke again to resume
abort_install() {
    log_warn "Setup aborted by user."
    build_resume_command
    exit 1
}

# If the user aborts with CTRL+C, print instructions on how to resume installation
trap "echo && abort_install" SIGINT

print_usage() {
    echo -e "Usage: $0 [--appdata <path>] [--env <file>]\n"
    echo -e "Options:\n"
    echo "  -p, --project <name>            Name to use for the Docker Compose project. [Default: 'self-host']"
    echo "  -e, --env <path>                Environment file to read variables from. [Default: './env']"
    echo "  -m, --module <module>           Includes the given module in the project. Can be specified multiple times."
    echo "  -o, --override <var>=<value>    Application data for deployment. [Default: '/srv/appdata']"
    echo "  -u, --user <user>               User to apply for file permissions. [Default: '$USER']"
    echo "  --resume                        Skip any steps that have been previously completed."
    echo "  --unattended                    Automatically answer prompts with defaults (implies --resume)."
    echo "  --no-download                   Do not download appdata from GitHub. Only use if appdata was previously downloaded."
    echo "  --override-compose              Override previously deployed docker-compose files. Use with caution!"
    echo "  --override-versions             Override image versions with those specified in compose file. Use with caution!"
    echo "  --custom-smtp                   Do not use SMTP2GO for sending email (custom SMTP configuration required)."
    echo "  --post-install                  Run post-install configuration of self-hosted apps."
    echo "  --dry-run                       Execute Docker Compose in dry run mode."
    echo "  -h, --help                      Display this help message."

    load_module_help
    echo -e "\nModules:\n"
    log_options MODULE_OPTIONS

    exit 1
}

################################################################################
#                           PARSE COMMAND LINE

while [ "$#" -gt 0 ]; do
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    --project | -p)
        if [ -n "$2" ]; then
            COMPOSE_PROJECT_NAME="$2"
            shift 2
            continue
        else
            echo "Error: $1 requires a name."
            exit 1
        fi
        ;;
    --env | -e)
        if [ -n "$2" ]; then
            ENV_FILE="$2"
            shift 2
            continue
        else
            echo "Error: $1 requires a file path."
            exit 1
        fi
        ;;
    --module | -m)
        if [ -n "$2" ]; then
            if [ "$2" = "all" ]; then find_modules; else ENABLED_MODULES+=("$2"); fi
            shift 2
            continue
        else
            echo "Error: $1 requires a value."
            exit 1
        fi
        ;;
    --override | -o)
        if [ -n "$2" ]; then
            # Parse override in form of: VARIABLE_NAME=VALUE
            if echo "$2" | grep -q '='; then
                eval "$(echo "$2" | cut -d '=' -f 1)_OVERRIDE=\"$(echo "$2" | cut -d '=' -f 2-)\""
            else
                echo "Error: $1 requires an assignment in the form VARIABLE_NAME=VALUE."
                exit 1
            fi
            shift 2
            continue
        else
            echo "Error: $1 requires an assignment in the form VARIABLE_NAME=VALUE."
            exit 1
        fi
        ;;
    --user | -u)
        if [ -n "$2" ]; then
            AS_USER="$2"
            shift 2
            continue
        else
            echo "Error: $1 requires a value."
            exit 1
        fi
        ;;
    --unattended)
        UNATTENDED=true
        RESUME=true
        shift 1
        continue
        ;;
    --override-compose)
        OVERRIDE_COMPOSE=true
        shift 1
        continue
        ;;
    --override-versions)
        OVERRIDE_VERSIONS=true
        shift 1
        continue
        ;;
    --custom-smtp)
        USE_SMTP2GO=false
        shift 1
        continue
        ;;
    --resume)
        RESUME=true
        shift 1
        continue
        ;;
    --post-install)
        POST_INSTALL=true
        shift 1
        continue
        ;;
    --no-download)
        NO_DOWNLOAD=true
        shift 1
        continue
        ;;
    --dry-run)
        COMPOSE_UP_OPTIONS="$COMPOSE_UP_OPTIONS --dry-run"
        shift 1
        continue
        ;;
    -h | --help)
        print_usage
        ;;
    *)
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
done

load_modules

################################################################################
#                           MAIN PROGRAM LOGIC

if [ "$POST_INSTALL" = "true" ]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"

    SECRETS_PATH="${APPDATA_LOCATION}/secrets/"

    configure_admin_account -l

    execute_hooks "${BOOTSTRAP_HOOKS[@]}" "bootstrap"

    log_done
    exit 0
fi

log_header "Preparing environment files"

if ! prepare_env_file; then
    log_error "Failed to prepare '$ENV_FILE'."
    exit 1
fi

ask_for_variables

log_header "Configuring Docker"
configure_docker

log_header "Configuring Tailscale"
configure_tailscale

log_header "Preparing application data folder"

create_data_locations

if [ "$NO_DOWNLOAD" != true ]; then
    download_appdata
fi

# Configuring CF tunnel requires that $SECRETS_LOCATION has already been created
log_header "Configuring CloudFlare Tunnel"
configure_cloudflare_tunnel

if [ "$USE_SMTP2GO" = "true" ]; then

    log_header "Configuring SMTP2GO Account"

    configure_smtp_domain
    if [ $? -ne 0 ]; then
        log_error "SMTP domain configuration failed."
        exit 1
    fi

    configure_smtp_user
    if [ $? -ne 0 ]; then
        log_error "SMTP user configuration failed."
        exit 1
    fi

    save_env SMTP_SERVER mail.smtp2go.com
    save_env SMTP_PORT "587"
    save_env SMTP_SECURE "tls"
fi

log_header "Configuring server administrator account"

configure_admin_account

log_header "Preparing secret files"

save_secrets

find_missing_modules

deploy_project

execute_hooks "${BOOTSTRAP_HOOKS[@]}" "bootstrap"

log_done