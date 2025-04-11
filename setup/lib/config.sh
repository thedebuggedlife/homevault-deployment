if [ -n "$__LIB_CONFIG" ]; then return 0; fi

__LIB_CONFIG=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

################################################################################
#                           MANIPULATING .ENV FILE

# Save a kvp to $ENV_FILE
# Params:   $1 Variable name
#           $2 Variable value
save_env() {
    local env_variable=$1
    local env_value=$2
    echo -e "Saving ${Purple}$env_variable${COff} in ${Cyan}$ENV_FILE${COff}"
    
    # Check if the variable exists in the file
    if grep -q "^${env_variable}=" "$ENV_FILE"; then
        # Update existing variable
        sed -i -E "s|^($env_variable)=.*|\1=${env_value}|" "$ENV_FILE" || {
            log_error "Failed to update '$env_variable' in '$ENV_FILE'"
            exit 1
        }
    else
        # Append new variable at the end of the file
        echo "${env_variable}=${env_value}" >> "$ENV_FILE" || {
            log_error "Failed to append '$env_variable' to '$ENV_FILE'"
            exit 1
        }
    fi
    
    # Set the variable in the current shell
    eval "$env_variable=$env_value"
}

# Generate a random id and save to $ENV_FILE
# Params:   $1 Variable name
#           $2 Length (#chars) of value [default=20]
save_env_id() {
    local env_variable=$1
    local id_length=${2:-20}
    local env_value="${!env_variable}"
    if [ -z "$env_value" ]; then
        env_value=$(tr -cd '[:alnum:]' </dev/urandom | fold -w "${id_length}" | head -n 1 | tr -d '\n')
    fi
    save_env "$env_variable" "$env_value"
}

# Prompt user for a value and save to $ENV_FILE
# Params:   $1 Variable name
#           $2 Text prompt
#           $3 If `true`, offer existing variable value as default [default=true]
#           $4 If `true`, do not allow empty values [default=true]
#           $5 If `true`, mask the input (password) [default=false]
ask_for_env() {
    local env_variable=$1
    local prompt=$2
    local use_default=${3:-true}
    local required=${4:-true}
    local masked=${5:-false}

    # If an override is specified in command line, that takes priority
    local name_override="${env_variable}_OVERRIDE"
    local value_override="${!name_override}"
    if [ -n "$value_override" ]; then
        save_env "$env_variable" "$value_override"
    fi

    # If resuming a previous install and there is a value already set, dismiss
    if [[ "$RESUME" = "true" && -n "${!env_variable}" && "$use_default" = "true" ]]; then 
        return 0
    fi

    # Choose the right default value to include in the prompt
    local default_value
    if [[ "$use_default" = "true" ]]; then
        local env_variable_default="${env_variable}_DEFAULT"
        default_value="${!env_variable:-${!env_variable_default}}"
    fi

    # Show the prompt to the use and save the result
    local user_input
    user_input=$(ask_value "$prompt" "$default_value" "$required" "" "$masked")
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
    echo -e "Creating secret file ${Cyan}$secret_filename${COff}"
    printf "%s" "${!env_variable}" >"$secret_filename"
}

# Create a random secret and save to a secret file
# Params:   $1 Secret file name
#           $2 Length (#chars) of generated secret
create_secret() {
    local secret_filename=$1
    local SECRET_LENGTH=${2:-40}
    if [ -f "$secret_filename" ]; then
        echo -e "Secret file ${Cyan}$secret_filename${COff} already exists."
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
        echo -e "The password and digest files for ${Cyan}$pair_name${COff} already exist."
        return 0
    fi
    local output password_value digest_value
    output=$(sg docker -c "docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --random --random.length ${password_length} --random.charset alphanumeric")
    password_value=$(echo "$output" | awk '/Random Password:/ {print $3}')
    digest_value=$(echo "$output" | awk '/Digest:/ {print $2}')
    if [ -z "$password_value" ] || [ -z "$digest_value" ]; then
        log_error "Password or digest extraction failed."
        exit 1
    fi
    echo -e "Creating password file ${Cyan}$password_filename${COff}"
    printf "%s" "$password_value" >"$password_filename"
    echo -e "Creating digest file ${Cyan}$digest_filename${COff}"
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
        echo -e "Private key file ${Cyan}$private_key${COff} already exists."
    else
        echo -e "Generating private key ${Cyan}$private_key${COff}."
        if ! openssl genrsa -out "$private_key" $key_length; then
            log_error "Failed to generate private key '$private_key'."
            exit 1
        fi
    fi
    if [ -f "$public_key" ]; then
        echo -e "Public key file ${Cyan}$public_key${COff} already exists."
    else
        echo -e "Generating public key ${Cyan}$public_key${COff}."
        if ! openssl rsa -in "$private_key" -outform PEM -pubout -out "$public_key"; then
            log_error "Failed to generate public key '$public_key'"
            exit 1
        fi
    fi
}

################################################################################
#                           HELPER FUNCTIONS

###
# Makes sure a given path exists, if not, it is created with $AS_USER:docker ownership
#
# @param {string} suffix - (optional) A file suffix for secondary files
# @return void
###
ensure_path_exists() {
    if [ ! -d "$1" ]; then
        sudo mkdir -p "$1" && \
        sudo chown "$AS_USER:docker" "$1" || {
            log_error "Failed to create path '$1'"
            exit 1
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
# Asks user for input
#
# @param {string} prompt    - The prompt to display
# @param {string} default   - The default value if user does not enter a value
# @param {boolean} required - If `true`, keep asking user for value until not empty
# @param {string} display   - The options to show in between square braces []
# @param {boolean} masked   - If `true` value will be treated as a secret (***)
# @return {string} The value entered by the user
###
ask_value() {
    local prompt="$1"
    local default="$2"
    local required=${3:-false}
    local display="${4:-${default}}"
    local masked=${5:-false}
    local user_input
    while true; do
        if [ "$masked" = "true" ]; then 
            display=$(mask_password "$display")
        fi
        local -a args=()
        if [ "$masked" = true ]; then args+=("-s"); fi
        if [[ -n "$display" ]]; then
            read "${args[@]}" -p "$prompt [${display}]: " user_input </dev/tty
        else
            read "${args[@]}" -p "$prompt: " user_input </dev/tty
        fi
        if [ "$masked" = true ]; then echo >&2; fi
        user_input=${user_input:-${default}}
        if [[ -n "$user_input" || "$required" != "true" ]]; then
            break
        fi
        echo -e "\n${Yellow}Empty value is not allowed. Please try again.${COff}\n" >&2
    done
    echo "$user_input"
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
    echo -e "Creating file ${Cyan}$filename${COff}"
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
        exit 1
    }
}