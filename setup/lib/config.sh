# shellcheck disable=SC2034

if [ -n "$__LIB_CONFIG" ]; then return 0; fi

__LIB_CONFIG=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

_PYTHON_INSTALLED=
_UPNPC_INSTALLED=

################################################################################
#                           PARAMETER VALIDATION

RE_VALID_PATH="^(?:\/?[a-zA-Z0-9._-]+)*\/?$"

RE_VALID_LOCAL_HOSTNAME="^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}$"

RE_VALID_HOSTNAME="^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$"

RE_VALID_USERNAME="^[a-z_][a-z0-9_-]{0,31}$"

RE_VALID_UID="^([0-9]|[1-9][0-9]{1,8})$"

RE_VALID_NUMBER="^([0-9]|[1-9][0-9]{1,8})$"

RE_MAIN_DOMAIN="^[a-zA-Z0-9][-a-zA-Z0-9]{0,61}[a-zA-Z0-9]\.[a-zA-Z][-a-zA-Z0-9]{0,61}[a-zA-Z]$"

RE_VALID_TUNNEL_NAME="^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$"

RE_VALID_EMAIL="^(([A-Za-z0-9]+((\.|\-|\_|\+)?[A-Za-z0-9]?)*[A-Za-z0-9]+)|[A-Za-z0-9]+)@(([A-Za-z0-9]+)+((\.|\-|\_)?([A-Za-z0-9]+)+)*)+\.([A-Za-z]{2,})+$"

RE_VALID_EMAIL_NAME="^[a-zA-Z0-9][-a-zA-Z0-9._]{0,62}[a-zA-Z0-9]$|^[a-zA-Z0-9]$"

RE_VALID_PORT_NUMBER="^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$"

RE_VALID_DURATION="^([0-9]+[smhdwy])+$"

MSG_INVALID_DURATION="Not a valid duration. Units supported: y, w, d, h, m, s, ms. Ex: 7d"

RE_VALID_STORAGE_SIZE="^[0-9]+([KMGTP]B|B)$"

MSG_INVALID_STORAGE_SIZE="Not a valid size. Units supported: B, KB, MB, GB, TB, PB, EB. Ex: 100GB"

is_valid_timezone() {
  local timezone="$1"
  if [ -f "/usr/share/zoneinfo/$timezone" ]; then
        return 0
    else
        return 1
    fi
}

################################################################################
#                           MANIPULATING .ENV FILE

###
# Asks user for input
#
# @param    $1  {string}    The prompt to display
# @option   -d  {default}   Default value if not specified
# @option   -e  {flag}      Allow empty values
# @option   -m  {flag}      Mask the input (e.g. for passwords)
# @option   -o  {list}      Valid options (comma-separated list)
# @option   -v  {string}    Regex pattern to validate input against, or name of a validation function, separated by ## from error message
# @return       {string}    The value entered by the user
###
ask_value() {
    local prompt="$1"
    local default options
    local required=true
    local masked=false
    local -a validations=()  # Array to store validation patterns and error messages
    local user_input
    OPTIND=2
    while getopts ":emd:o:v:" opt; do
        case $opt in
            e) required=false ;;
            m) masked=true ;;
            d) default="$OPTARG" ;;
            o) options="$OPTARG" ;;
            v) validations+=("$OPTARG") ;;  # Add each validation to the array
            \?) log_warn "Invalid option: -$OPTARG" ;;
            :) log_warn "Option -$OPTARG requires an argument" ;;
        esac
    done

    local -a args=()
    local display="$default"
    if [ "$masked" = "true" ]; then 
        args+=("-s")
        display=$(mask_password "$default")
    fi

    if [ -n "$options" ]; then prompt="$prompt ($options)"; fi
    if [ -n "$display" ]; then prompt="$prompt [$display]"; fi

    while true; do
        log
        read "${args[@]}" -p "$prompt: " user_input </dev/tty
        if [ "$masked" = true ]; then log; fi
        user_input=${user_input:-${default}}
        if [ -z "$user_input" ]; then
            if [ "$required" = "false" ]; then
                break;
            fi
            log "\n${Yellow}Empty value is not allowed. Please try again.${COff}\n"
            continue
        fi
        if [ -n "$options" ] && ! echo ",$options," | grep -q ",${user_input},"; then
            log "\n${Yellow}Value must be one of the options: ${options}${COff}\n"
            continue
        fi
        
        # Process all validations
        local validation_failed=false
        for validation in "${validations[@]}"; do
            # Split validation pattern and error message by ##
            local validation_pattern="${validation%%##*}"
            local validation_error="${validation##*##}"
            
            # If no ## separator found, use default error message
            if [ "$validation_pattern" = "$validation_error" ]; then
                validation_error="Please enter a valid value."
            fi
            
            # Check if validation_pattern is a function name (no spaces, starts with letter)
            if [[ "$validation_pattern" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] && declare -F "$validation_pattern" >/dev/null; then
                # Call the validation function
                if ! "$validation_pattern" "$user_input"; then
                    log "\n${Yellow}${validation_error}${COff}\n"
                    validation_failed=true
                    break
                fi
            # Otherwise treat as regex pattern
            elif ! [[ "$user_input" =~ $validation_pattern ]]; then
                log "\n${Yellow}${validation_error}${COff}\n"
                validation_failed=true
                break
            fi
        done
        
        # If any validation failed, continue the loop to ask again
        if [ "$validation_failed" = true ]; then
            continue
        fi
        
        break
    done
    echo "$user_input"
}

###
# Asks a yes/no question.
#
# @option   -y              Answer defaults to "Y" (yes), otherwise defaults to "N" (no)
# @option   -p {prompt}     The prompt to display. Defaults to: "Do you want to continue?"
#
# @return   The function exits with 0 if the answer is yes, otherwise it exits with 1.
#
# @example:
#   if ask_confirmation -y -p "Do you want to install Tailscale?"; then
#       install_tailscale
#   fi
###
ask_confirmation() {
    local prompt="Do you want to continue?"
    local default=N
    local options="y/N"
    OPTIND=1
    while getopts "yp:" opt; do
        case $opt in
            y) default=Y; options="Y/n" ;;
            p) prompt="$OPTARG" ;;
            *) log_warn "Invalid option: -$OPTARG" ;;
        esac
    done
    local user_input
    if [ "$UNATTENDED" != true ]; then
        read -p "$prompt [$options] " user_input </dev/tty
    fi
    user_input=${user_input:-$default}
    if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 1; fi
}

###
# Save a kvp to the env file
# @param    $1 {string} Variable name
# @param    $2 {string} Variable value
# @param    $3 {string} Target file [default=$ENV_FILE]
###
save_env() {
    local env_variable=$1
    local env_value=$2
    local env_file=${3:-$ENV_FILE}
    log "Saving ${Purple}$env_variable${COff} in ${Cyan}$env_file${COff}"
    
    # Check if the variable exists in the file
    if grep -q "^${env_variable}=" "$env_file"; then
        # Update existing variable
        sed -i -E "s|^($env_variable)=.*|\1=${env_value}|" "$env_file" || {
            log_error "Failed to update '$env_variable' in '$env_file'"
            exit 1
        }
    else
        # Append new variable at the end of the file
        echo "${env_variable}=${env_value}" >> "$env_file" || {
            log_error "Failed to append '$env_variable' to '$env_file'"
            exit 1
        }
    fi
    
    # Set the variable in the current shell
    eval "$env_variable=$env_value" || {
        log_error "Failed to set '$env_variable' to '$env_value'"
        exit 1
    }
}

###
# Generate a random id and save it to the env file
# @param    $1 {string} Variable name
# @option   -l {number} Length (in chars) of value [default=20]
# @option   -f {path}   Path to the env file [default=$ENV_FILE]
###
save_env_id() {
    local env_variable=$1
    shift
    local env_file=${ENV_FILE}
    local id_length=20
    OPTIND=1
    while getopts ":l:f:" opt; do
        case $opt in
        l) id_length="$OPTARG" ;;
        f) env_file="$OPTARG" ;;
        \?) log_warn "Invalid option: -$OPTARG" ;;
        esac
    done
    local env_value="${!env_variable}"
    if [ -z "$env_value" ]; then
        env_value=$(tr -cd '[:alnum:]' </dev/urandom | fold -w "${id_length}" | head -n 1 | tr -d '\n')
    fi
    save_env "$env_variable" "$env_value" "$env_file"
}

###
# Add a prompt to the JSON_OUTPUT for the WebUI
#
# @param    $1 {string}     Variable name
# @param    $2 {string}     Text prompt
# @option   -a {string}     Alternate default if no existing value
# @option   -e {flag}       Allow empty values
# @option   -m {flag}       Mask the input (e.g. for passwords)
# @option   -o {string}     Valid options (comma-separated list)
# @option   -v {string}     Regex pattern to validate input against, separated by ## from error message
###
webui_add_prompt() {
    local module="$1"
    local variable="$2"
    local prompt="$3"
    shift 3
    
    local optional="false"
    local password="false"
    local default="${!variable}"
    local options=""
    local condition=""
    local -a validations=()
    
    # Parse optional parameters
    OPTIND=1
    while getopts ":a:emo:v:c:" opt; do
        case $opt in
            e) optional="true" ;;
            m) password="true" ;;
            a) if [ -z "$default" ]; then default="$OPTARG"; fi ;;
            c) condition="$OPTARG" ;;
            o) options="$OPTARG" ;;
            v) validations+=("$OPTARG") ;;
            *) log_error "Unknown option: $opt"; return 1 ;;
        esac
    done
    
    # Build the regex array if validations exist
    local regex_json="[]"
    if [ ${#validations[@]} -gt 0 ]; then
        regex_json=$(printf '%s\n' "${validations[@]}" | jq -R '
            if contains("##") then
                split("##") | {pattern: .[0], message: .[1]}
            else
                {pattern: .}
            end
        ' | jq -s '.')
    fi
    
    # Build the prompt object
    local prompt_obj
    prompt_obj=$(jq -n \
        --arg module "$module" \
        --arg var "$variable" \
        --arg prompt "$prompt" \
        --arg optional "$optional" \
        --arg password "$password" \
        --arg default "$default" \
        --arg condition "$condition" \
        --arg options "$options" \
        --argjson regex "$regex_json" \
        '{
            module: $module,
            variable: $var,
            prompt: $prompt,
            optional: ($optional == "true"),
            password: ($password == "true"),
        } |
        if $default != "" then
            . + {default: $default}
        else . end |
        if $condition != "" then
            . + {condition: $condition}
        else . end |
        if $options != "" then
            . + {options: ($options | split(",") | map(ltrimstr(" ") | rtrimstr(" ")))}
        else . end |
        if $regex != [] then
            . + {regex: $regex}
        else . end'
    )
    
    # Add the prompt to JSON_OUT
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --argjson prompt "$prompt_obj" '
        if has("prompts") then
            .prompts += [$prompt]
        else
            . + {prompts: [$prompt]}
        end
    ')
}

###
# Prompt user for a value and save to $ENV_FILE
#
# @param    $1 {string}     Variable name
# @param    $2 {string}     Text prompt
# @option   -i {flag}       Ignore existing value (i.e. do not offer as default)
# @option   -a {string}     Use alternative value as default
# @option   -e {flag}       Allow empty values
# @option   -m {flag}       Mask the input (e.g. for passwords)
# @option   -o {string}     Valid options (comma-separated list)
# @option   -v {string}     Regex pattern to validate input against, or name of a validation function, separated by ## from error message
###
ask_for_env() {
    local env_variable=$1
    local prompt=$2
    local -a input_opts=()
    local -a webui_opts=()
    local use_default=true
    local default_value="${!${env_variable}_DEFAULT}"
    OPTIND=3
    while getopts ":iemo:v:E:a:" opt; do
        case $opt in
            i) use_default=false ;;
            a) default_value="$OPTARG" ;;
            e) input_opts+=("-e") ;;
            m) input_opts+=("-m") ;;
            o) input_opts+=("-o" "$OPTARG") ;;
            v) input_opts+=("-v" "$OPTARG") ;;
            E) input_opts+=("-E" "$OPTARG") ;;
            \?) log_warn "Invalid option: -$OPTARG" ;;
            :) log_warn "Option -$OPTARG requires an argument" ;;
        esac
    done

    if [[ "$use_default" = "true" ]]; then
        input_opts+=("-d" "${!env_variable:-${default_value}}")
    fi

    # If an override is specified in command line, that takes priority
    local value_override="${ENV_OVERRIDES["$env_variable"]}"
    if [ -n "$value_override" ]; then
        save_env "$env_variable" "$value_override"
    fi

    # If resuming a previous install and there is a value already set, dismiss
    if [[ "$USE_DEFAULTS" = "true" && -n "${!env_variable}" && "$use_default" = "true" ]]; then 
        return 0
    fi

    # Show the prompt to the use and save the result
    local user_input
    user_input=$(ask_value "$prompt" "${input_opts[@]}")
    save_env "$env_variable" "$user_input"
}

################################################################################
#                           MANIPULATING SECRETS

# Save the value of an environment variable to a secret file
# Params:   $1 Secret file name
#           $2 Variable name
save_env_secret() {
    local secret_filename=$1
    local env_variable=$2
    if [ ! -n "${!env_variable}" ]; then
        log_error "Missing value for '$env_variable' in '$ENV_FILE'"
        exit 1
    fi
    log "Creating secret file ${Cyan}$secret_filename${COff}"
    printf "%s" "${!env_variable}" >"$secret_filename"
}

# Create a random secret and save to a secret file
# Params:   $1 Secret file name
#           $2 Length (#chars) of generated secret
create_secret() {
    local secret_filename=$1
    local SECRET_LENGTH=${2:-40}
    if [ -f "$secret_filename" ]; then
        log "Secret file ${Cyan}$secret_filename${COff} already exists."
    else
        local secret_value
        secret_value=$(tr -cd '[:alnum:]' </dev/urandom | fold -w "${SECRET_LENGTH}" | head -n 1 | tr -d '\n')
        write_file "$secret_value" "$secret_filename"
    fi
}

# Create a random password and its digest and save to a secret file
# Uses Authelia's crypto hash generation with argon2 algorithm
# Params:   $1 Name of the password/digest pair
#           $2 Length (#chars) of the generated password [default=64]
create_password_digest_pair() {
    local pair_name=$1
    local password_length=${2:-64}
    local password_filename="${pair_name}_password"
    local digest_filename="${pair_name}_digest"
    if [ -f "$password_filename" ] && [ -f "$digest_filename" ]; then
        log "The password and digest files for ${Cyan}$pair_name${COff} already exist."
        return 0
    fi
    local output password_value digest_value
    output=$(sg docker -c "docker run -q --rm authelia/authelia:latest authelia crypto hash generate argon2 --random --random.length ${password_length} --random.charset alphanumeric")
    password_value=$(echo "$output" | awk '/Random Password:/ {print $3}')
    digest_value=$(echo "$output" | awk '/Digest:/ {print $2}')
    if [ -z "$password_value" ] || [ -z "$digest_value" ]; then
        log_error "Password or digest extraction failed."
        exit 1
    fi
    log "Creating password file ${Cyan}$password_filename${COff}"
    printf "%s" "$password_value" >"$password_filename"
    log "Creating digest file ${Cyan}$digest_filename${COff}"
    printf "%s" "$digest_value" >"$digest_filename"
}

# Create an RSA key using OpenSSL and saves private and public keys to file
# Params:   $1 Name of the private key file
#           $2 Name of the public key file
#           $3 Lenght of the key [default=2048]
create_rsa_keypair() {
    local private_key=$1
    local public_key=$2
    local key_length=${3:-2048}
    if [ -f "$private_key" ]; then
        log "Private key file ${Cyan}$private_key${COff} already exists."
    else
        log "Generating private key ${Cyan}$private_key${COff}."
        if ! openssl genrsa -out "$private_key" $key_length; then
            log_error "Failed to generate private key '$private_key'."
            exit 1
        fi
    fi
    if [ -f "$public_key" ]; then
        log "Public key file ${Cyan}$public_key${COff} already exists."
    else
        log "Generating public key ${Cyan}$public_key${COff}."
        if ! openssl rsa -in "$private_key" -outform PEM -pubout -out "$public_key"; then
            log_error "Failed to generate public key '$public_key'"
            exit 1
        fi
    fi
}

###
# Copy all key=value pairs from one .env file to another
# @param    $1 {path}   Source file
# @param    $2 {path}   Destination file
# @option   -o          Override existing keys
###
copy_env_values() {
    local source=$1 destination=$2 overwrite=false newfile=true
    OPTIND=3
    while getopts ":o" opt; do
        case $opt in
            o) overwrite=true;;
            *) log_warn "Invalid option: -$OPTARG" ;;
        esac
    done
    if [ -f "$destination" ]; then newfile=false; fi
    if [ -s "$source" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments and empty lines
            if [[ ! "$line" =~ ^[[:space:]]*# && -n "$line" ]]; then
                # Extract key from line, everything before first =
                key="${line%%=*}"
                if [[ -n "$key" && "$line" == *"="* ]]; then
                    # If key does not already exist in root .env file, append the line
                    if [[ "$newfile" = true ]] || ! grep -q "^${key}=" "$destination"; then
                        append_file "$line" "$destination" || return 1
                        if [ "$newfile" = false ]; then
                            log "Added ${Purple}$key${COff} to ${Cyan}$destination${COff}."
                        fi
                    elif [ "$overwrite" = true ]; then
                        value="${line#*=}"
                        sed -i "s|^${key}=.*|${key}=${value}|" "$destination" || {
                            log_error "Failed to update file: '$destination'"
                            return 1
                        }
                        log "Updated ${Purple}$key${COff} in ${Cyan}$destination${COff}."
                    fi
                fi
            fi
        done < "$source"
    fi
}

################################################################################
#                           DEPLOYMENT FILE

save_deployment_file() {
    log_header "Saving deployment manifest"
    local deployment_file="${PROJECT_PATH%/}/deployment.json"

    BACKUP_SERVICES=()
    BACKUP_FILTER_INCLUDE=()
    BACKUP_FILTER_EXCLUDE=()
    execute_hooks "${BACKUP_CONFIG_HOOKS[@]}" "backup-config" || exit 1

    # Substitute any environment variables specified in the following array items
    local backup_services backup_include backup_exclude
    readarray -t backup_services < <(env_subst "${BACKUP_SERVICES[@]}")
    readarray -t backup_include < <(env_subst "${BACKUP_FILTER_INCLUDE[@]}")
    readarray -t backup_exclude < <(env_subst "${BACKUP_FILTER_EXCLUDE[@]}")

    log "\nSaving deployment settings to ${Cyan}$deployment_file${COff}"
    jq -n \
        --arg version "$PROJECT_VERSION" \
        --arg project "$COMPOSE_PROJECT_NAME" \
        --argjson modules "$(jq -n --args '$ARGS.positional' "${ENABLED_MODULES[@]}")" \
        --arg appdata "$APPDATA_LOCATION" \
        --argjson backup_services "$(jq -n --args '$ARGS.positional' "${backup_services[@]}")" \
        --argjson backup_include "$(jq -n --args '$ARGS.positional' "${backup_include[@]}")" \
        --argjson backup_exclude "$(jq -n --args '$ARGS.positional' "${backup_exclude[@]}")" '
        {
            version: $version,
            project: $project,
            modules: $modules,
            appdata: $appdata,
            backup: {
                services: $backup_services,
                filters: {
                    include: $backup_include,
                    exclude: $backup_exclude,
                }
            }
        }
    ' > "$deployment_file" && chmod 600 "$deployment_file" || {
        log_error "Failed to save file '$deployment_file'"
        return 1
    }

    # Copy the ENV file to include in backup/restore
    log "\nSaving deployment environment to ${Cyan}${PROJECT_PATH%/}/.env${COff}"
    cp -f "$ENV_FILE" "${PROJECT_PATH%/}/.env" || {
        log_error "Failed to save file '${PROJECT_PATH%/}/.env'"
        return 1
    }
}

load_deployment_file() {
    local deployment_file="${1:-"${PROJECT_PATH%/}/deployment.json"}"

    if [ ! -f "$deployment_file" ]; then
        log_error "File not found: '$deployment_file'"
        return 1
    fi

    log "Loading deployment settings from ${Cyan}$deployment_file${COff}"
    # shellcheck disable=SC2015
    COMPOSE_PROJECT_NAME=$(jq -r '.project' "$deployment_file") &&
    readarray -t ENABLED_MODULES < <(jq -r '.modules[]' "$deployment_file") &&
    APPDATA_LOCATION=$(jq -r '.appdata' "$deployment_file") &&
    readarray -t BACKUP_SERVICES < <(jq -r '.backup.services[]' "$deployment_file") &&
    readarray -t BACKUP_FILTER_INCLUDE < <(jq -r '.backup.filters.include[]' "$deployment_file") &&
    readarray -t BACKUP_FILTER_EXCLUDE < <(jq -r '.backup.filters.exclude[]' "$deployment_file") || {
        log_error "Failed to parse '$deployment_file'"
        return 1
    }
}

################################################################################
#                           HELPER FUNCTIONS

###
# Check if an element is in an array
#
# @param $1     {list}      Item(s) to search for (separated by ':')
# @param $*     {array}     Array to search
#
# @return   0 if found, 1 otherwise
###
array_contains() {
    local seeking="$1"
    shift
    local -a array=("$@")
    local found=1

    IFS=':' read -ra search_items <<< "$seeking"

    for search_item in "${search_items[@]}"; do
        for element in "${array[@]}"; do
            if [[ "$element" == "$search_item" ]]; then
                found=0
                break 2
            fi
        done
    done

    return $found
}

###
# Remove one (or more) items from an array
#
# @param $1 {string} Name of the array (passed by-ref)
# @param $* {string} One or more items to remove from the array
###
remove_from_array() {
  local -n arr="$1"
  shift
  
  for remove_element in "$@"; do
    local new_array=()
    for item in "${arr[@]}"; do
      if [[ "$item" != "$remove_element" ]]; then
        new_array+=("$item")
      fi
    done
    
    arr=("${new_array[@]}")
  done
}

###
# Makes sure a given path exists, if not, it is created with $AS_USER:docker ownership
#
# Parameters:
#   $1 {string} Path to create
#
# @return void
###
ensure_path_exists() {
    if [ ! -d "$1" ]; then
        sudo mkdir -p "$1" && \
        sudo chown "$AS_USER:docker" "$1" || {
            log_error "Failed to create path '$1'"
            return 1
        }
    fi
}

###
# Create a string of '*' characters with the same length as the input
#
# @param {string} suffix - (optional) A file suffix for secondary files
# @return void
###
mask_password() {
    local input="$1"
    local len=${#input}
    printf "%${len}s" "" | tr ' ' '*'
}

###
# Writes a string to a file. Replaces the previous file contents.
#
# @param {string} $1 The string to write to the file
# @param {string} $2 The name of the file to write
# @return {void}
###
write_file() {
    local content=$1
    local filename=$2
    log "Creating file ${Cyan}$filename${COff}"
    ensure_path_exists "$(dirname "$filename")" || return 1
    printf "%s" "$content" >"$filename" || {
        log_error "Failed to write to file: '$filename'"
        exit 1
    }
}

###
# Writes a string to a file. Appends to the end of the file.
#
# @param {string} $1 The string to write to the file
# @param {string} $2 The name of the file to write
# @return {void}
###
append_file() {
    local content=$1
    local filename=$2
    printf "%s\n" "$content" >>"$filename" || {
        log_error "Failed to write to file: '$filename'"
        return 1
    }
}

###
# Merge YAML configuration files using yq and the provided expression. Output
# is placed in $APPDATA_LOCATION under the specified path
#
# @param    $1  {string}    Name of the configuration file
# @param    $2  {string}    Path under '$PROJECT_ROOT/modules/<module>/' where the source is located
# @option   -d  {string}    Destination path under '$APPDATA_LOCATION' where the output is saved (optional)
# @option   -e  {string}    YQ expression to use for the merge operation (optional)
# @option   -m  {string}    First module to load configuration for (optional)
###
merge_yaml_config() {
    local filename="$1"
    local module_path="$2"
    local appdata_path="$2"
    # shellcheck disable=SC2016
    local expression='. as $item ireduce({}; . *+ $item)'
    local -a modules=("${ENABLED_MODULES[@]}")
    OPTIND=3
    while getopts ":d:e:m:" opt; do
        # shellcheck disable=SC2207
        case $opt in
            d) appdata_path="$OPTARG" ;;
            e) expression="$OPTARG" ;;
            m) modules=("$OPTARG" $(printf '%s\n' "${ENABLED_MODULES[@]}" | grep -v "^${OPTARG}\$")) ;;
            \?) log_warn "Invalid option: -$OPTARG" ;;
            :) log_warn "Option -$OPTARG requires an argument" ;;
        esac
    done

    local -a file_list=()
    for module in "${modules[@]}"; do
        if [[ -f "${PROJECT_ROOT%/}/modules/$module/$module_path/$filename" ]]; then
            file_list+=("modules/$module/$module_path/$filename")
        fi
    done

    local configuration
    if ! configuration=$(yq "${PROJECT_ROOT%/}/" ea "$expression" "${file_list[@]}"); then
        log_error "Failed to merge configuration"
        return 1
    fi

    # Substitute environment variables with format ${VAR} and also un-quote any go-template placeholders
    configuration=$(env_subst "$configuration" | sed 's/'\''{{/{{/g; s/}}'\''/}}/g')
    write_file "$configuration" "${APPDATA_LOCATION%/}/$appdata_path/$filename" || {
        log_error "Failed to write configuration"
        return 1
    }
}

###
# Checks if the specified packages are installed, if not it proceeds to install them
#
# @param $1 {string} The list of packages separated by spaces, e.g. "sssd sssd-tools"
#
# @return   {void}
###
ensure_packages_installed() {
    local packages=$1

    # Detect package manager
    if command -v dpkg >/dev/null 2>&1; then
        # Debian/Ubuntu
        for pkg in $packages; do
            if dpkg -s "$pkg" >/dev/null 2>&1; then
                log "${Purple}$pkg${COff} is already installed"
            else
                log "Installing ${Purple}$pkg${COff} ..."
                if ! sudo apt-get install -y "$pkg"; then
                    log_error "Failed to install package '$pkg'"
                    return 1
                fi
            fi
        done
    elif command -v rpm >/dev/null 2>&1; then
        # Determine if it's RHEL/CentOS/Fedora
        if command -v dnf >/dev/null 2>&1; then
            # Fedora or newer RHEL/CentOS
            for pkg in $packages; do
                if rpm -q "$pkg" >/dev/null 2>&1; then
                    log "${Purple}$pkg${COff} is already installed"
                else
                    log "Installing ${Purple}$pkg${COff} ..."
                    if ! sudo dnf install -y "$pkg"; then
                        log_error "Failed to install package '$pkg'"
                        return 1
                    fi
                fi
            done
        elif command -v yum >/dev/null 2>&1; then
            # Older RHEL/CentOS
            for pkg in $packages; do
                if rpm -q "$pkg" >/dev/null 2>&1; then
                    log "${Purple}$pkg${COff} is already installed"
                else
                    log "Installing ${Purple}$pkg${COff} ..."
                    if ! sudo yum install -y "$pkg"; then
                        log_error "Failed to install package '$pkg'"
                        return 1
                    fi
                fi
            done
        else
            log_error "Unknown distribution, cannot install packages '$packages'"
            return 1
        fi
    elif command -v pacman >/dev/null 2>&1; then
        # Arch Linux
        for pkg in $packages; do
            if pacman -Qq "$pkg" >/dev/null 2>&1; then
                log "${Purple}$pkg${COff} is already installed"
            else
                log "Installing ${Purple}$pkg${COff} ..."
                if ! sudo pacman -S --noconfirm "$pkg"; then
                    log_error "Failed to install package '$pkg'"
                    return 1
                fi
            fi
        done
    elif command -v zypper >/dev/null 2>&1; then
        # OpenSUSE
        for pkg in $packages; do
            if zypper search -i "$pkg" | grep -q "$pkg"; then
                log "${Purple}$pkg${COff} is already installed"
            else
                log "Installing ${Purple}$pkg${COff} ..."
                if ! sudo zypper install -y "$pkg"; then
                    log_error "Failed to install package '$pkg'"
                    return 1
                fi
            fi
        done
    elif command -v apk >/dev/null 2>&1; then
        # Alpine
        for pkg in $packages; do
            if apk info -e "$pkg" >/dev/null 2>&1; then
                log "${Purple}$pkg${COff} is already installed"
            else
                log "Installing ${Purple}$pkg${COff} ..."
                if ! sudo apk add "$pkg"; then
                    log_error "Failed to install package '$pkg'"
                    return 1
                fi
            fi
        done
    elif command -v emerge >/dev/null 2>&1; then
        # Gentoo
        for pkg in $packages; do
            # In Gentoo, we need to check differently since package names have categories
            if equery list "*/$pkg" >/dev/null 2>&1; then
                log "${Purple}$pkg${COff} is already installed"
            else
                log "Installing ${Purple}$pkg${COff} ..."
                if ! sudo emerge --ask=n "$pkg"; then
                    log_error "Failed to install package '$pkg'"
                    return 1
                fi
            fi
        done
    else
        log_error "Unknown distribution, cannot install packages '$packages'"
        return 1
    fi
}

env_subst() {
    # shellcheck source=/dev/null
    (
        set -a
        source "$ENV_FILE"
        set +a
        for item in "$@"; do
            echo "$item" | envsubst
        done
    )
}

check_python3() {
    if [ "${_PYTHON_INSTALLED}" = true ]; then return 0; fi
    if command -v python3 >/dev/null 2>&1; then
        _PYTHON_INSTALLED=true
        # shellcheck disable=SC2155
        local version=$(python3 --version 2>&1 | awk '{print $2}')
        log "Python 3 is installed, version: ${Purple}$version${COff}"
        return 0
    else
        log "\n${Yellow}Python is not installed.${COff}\n"
        log "Installing Python..."
        ensure_packages_installed "python3" || return 1
        _PYTHON_INSTALLED=true
    fi
}

check_upnpc() {
    if [ "${_UPNPC_INSTALLED}" = true ]; then return 0; fi
    if command -v upnpc >/dev/null 2>&1; then
        _UPNPC_INSTALLED=true
        return 0
    else
        log "\n${Yellow}upnpc is not installed.${COff}\n"
        log "Installing upnpc..."
        ensure_packages_installed "miniupnpc" || return 1
        _UPNPC_INSTALLED=true
    fi
}