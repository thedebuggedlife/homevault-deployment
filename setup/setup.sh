#!/bin/bash
set -o pipefail

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="${PROJECT_ROOT%/}"

source "$PROJECT_ROOT/lib/logging.sh"
source "$PROJECT_ROOT/lib/config.sh"
source "$PROJECT_ROOT/lib/smtp2go.sh"

SECRETS_PATH=
UNATTENDED=
USE_SMTP2GO=true
POST_INSTALL=
RESUME=false
ENV_FILE=.env
AS_USER="$USER"
COMPOSE_PROJECT=self-host
COMPOSE_OPTIONS=
COMPOSE_UP_OPTIONS=

# Base module should always be first in the list
declare -a ENABLED_MODULES=("base")

################################################################################
#                           SETUP MODULES

declare -a CONFIG_ENV_HOOKS=()
declare -a CONFIG_SECRETS_HOOKS=()
declare -a PRE_INSTALL_HOOKS=()
declare -a POST_INSTALL_HOOKS=()
declare -a BOOTSTRAP_HOOKS=()
declare -A MODULE_OPTIONS

load_modules() {
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
    
    echo -e "Executing ${Purple}$hook_name${COff} hooks..."

    echo "${hooks[@]}"

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
        ENABLED_MODULES+=("$module_name")
    done
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
        echo -en "Project ${Purple}$COMPOSE_PROJECT${COff} is ready for deployment. "
        read -p "Do you want to proceed? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
    fi
    if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
        abort_install
    fi

    COMPOSE_OPTIONS="-p '$COMPOSE_PROJECT' --env-file '$ENV_FILE' $COMPOSE_OPTIONS"
    COMPOSE_UP_OPTIONS="-d -y --remove-orphans --quiet-pull --wait $COMPOSE_UP_OPTIONS"

    for module in "${ENABLED_MODULES[@]}"; do
        local compose_file="$PROJECT_ROOT/modules/$module/docker-compose.yml"
        if [ -f "$compose_file" ]; then
            COMPOSE_OPTIONS="$COMPOSE_OPTIONS -f $compose_file"
        fi
    done

    execute_hooks "${PRE_INSTALL_HOOKS[@]}" "pre-install"

    log_header "Deploying services"

    echo -e "Deploying project ${Purple}$COMPOSE_PROJECT${COff}..."
    if ! sg docker -c "docker compose $COMPOSE_OPTIONS up $COMPOSE_UP_OPTIONS"; then
        log_error "Docker Compose deployment failed"
        exit 1
    fi

    execute_hooks "${POST_INSTALL_HOOKS[@]}" "post-install"
}

###
# Create the file used by LLDAP to bootstrap the administrator account
#
# @return void
###
configure_admin_account() {
    local config_file="${APPDATA_LOCATION%/}/lldap/bootstrap/user-configs/admin.json"
    local username email password display_name

    # Apply any overrides passed via -o flag
    username="${ADMIN_USERNAME_OVERRIDE}"
    email="${ADMIN_EMAIL_OVERRIDE}"
    password="${ADMIN_PASSWORD_OVERRIDE}"
    display_name="${ADMIN_DISPLAY_NAME_OVERRIDE}"

    local save_file=false
    if [[ -n "$username" || -n "$email" || -n "$password" || -n "$display_name" ]]; then
        save_file=true
    fi

    # Read the values from file (if it exists)
    if [[ -f "$config_file" ]]; then
        username=${username:-"$(jq -r '.id' "$config_file")"}
        email=${email:-"$(jq -r '.email' "$config_file")"}
        password=${password:-"$(jq -r '.password' "$config_file")"}
        display_name=${display_name:-"$(jq -r '.displayName' "$config_file")"}
    fi

    # If already configured and the --resume flag was specified, skip the rest
    if [[ -z "$username" || -z "$email" || -z "$password" || -z "$display_name" || "$RESUME" != "true" ]]; then
        echo -e "Configuring the user account for the server administrator...\n" 

        username=$(ask_value "Username" "$username" true)
        email=$(ask_value "Email address" "$email" true)
        password=$(ask_value "Password" "$password" true "$password" true)
        display_name=$(ask_value "Display name (e.g. <First> <Last>)" "$display_name" true)

        save_file=true
    fi

    if [ "$save_file" = "true" ]; then
        local json
        if ! json=$( [ -s "$config_file" ] && cat "$config_file" || echo "{}" ); then
            log_error "Failed to read JSON for server administrator"
            exit 1
        fi
        if ! json=$(echo "$json" | jq \
            --arg id "$username" \
            --arg email "$email" \
            --arg password "$password" \
            --arg displayName "$display_name" '
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

    write_file "$username" "${SECRETS_PATH}server_admin_username"
    write_file "$password" "${SECRETS_PATH}server_admin_password"
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
    echo "$(printf "%q " "${cmd[@]}")"
}

# Terminate program and print instructions on how to invoke again to resume
abort_install() {
    log_warn "Setup aborted by user."
    echo -e "To resume, run: ${BIGreen}$(build_resume_command)${COff}\n"
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
    echo "  --unattended                    Automatically answer prompts with defaults (implies --resume)."
    echo "  --custom-smtp                   Do not use SMTP2GO for sending email (custom SMTP configuration required)."
    echo "  --resume                        Skip any steps that have been previously completed."
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
            COMPOSE_PROJECT="$2"
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

    execute_hooks "${BOOTSTRAP_HOOKS[@]}" "post-install"

    log_done
    exit 0
fi

log_header "Preparing deployment files"

prepare_env_file
if [ $? -ne 0 ]; then
    log_error "Failed to prepare '$ENV_FILE'."
    exit 1
fi

ask_for_variables

log_header "Preparing application data folder"

create_data_locations

download_appdata

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

deploy_project

log_done