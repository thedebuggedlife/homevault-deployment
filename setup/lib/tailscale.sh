if [ -n "$__LIB_TAILSCALE" ]; then return 0; fi

__LIB_TAILSCALE=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

TAILSCALE_IP=
TAILSCALE_API_BASE_URL=https://api.tailscale.com/api/v2

################################################################################
#                            TAILSCALE API CLIENT

###
# Makes a request to the Tailscale API
#
# @param {string} http_method   - The HTTP Method
# @param {string} url_path      - The relative path of the API
# @param {json} request_body    - (optional) The JSON object to send with the request
# @return void
###
tailscale_rest_call() {
    local response
    if ! response=$(rest_call $1 "$TAILSCALE_API_BASE_URL/$2" -h "Authorization: Bearer ${TAILSCALE_API_KEY}" -b "$3"); then
        return 1
    fi
    echo "$response"
}

###
# Creates an authentication key that can be used to connect a new device to the tailnet
#
# @return {string} - The authentication key
###
tailscale_create_auth_key() {
    local response
    body='{"capabilities":{"devices":{"create":{"reusable":false,"ephemeral":false,"preauthorized":true}}},"expirySeconds":120}'
    if ! response=$(tailscale_rest_call "POST" "tailnet/-/keys" "$body"); then
        return 1
    fi
    local key
    if ! key=$(echo "$response" | jq -r '.key') || [ -z "$key" ]; then
        log_error "Failed to retrieve key from server response"
        return 1
    fi
    echo "$key"
}

###
# Finds a device in the tailnet by IP address
#
# @param {string} ip    - The IP of the device to look for
# @return {json}        - The device if found, or empty
###
tailscale_find_device() {
    local ip=$1
    local response
    if ! response=$(tailscale_rest_call "GET" tailnet/-/devices); then
        return 1
    fi
    echo "$response" | jq --arg ip "$ip" '.devices[] | select(.addresses[] == $ip)'
}

###
# Disables key expiration for a given tailscale device
#
# @param {string} device_id - The device to disable key expiration for
# @return void
###
tailscale_disable_key_expiration() {
    local device_id=$1
    local body='{"keyExpiryDisabled":true}'
    tailscale_rest_call POST "device/${device_id}/key" "$body" > /dev/null || return 1
}

################################################################################
#                          TAILSCALE SETUP STEPS

###
# Checks that tailscale is installed
#
# @return void
###
tailscale_check_installed() {
    if ! command -v tailscale >/dev/null 2>&1; then
        log "\n${Yellow}Tailscale is not installed.${COff}"

        if ask_confirmation -y -p "Do you want to install tailscale?"; then
            log "Installing tailscale..."
            if ! curl -fsSL https://tailscale.com/install.sh | sh >/dev/null; then
                log_error "Failed to install tailscale"
                exit 1
            else
                sudo systemctl enable --now tailscaled || {
                    log_error "Failed to enable tailscale auto-start"
                    exit 1
                }
                log "\n✅ Tailscale installation completed successfully\n"
            fi
        else
            abort_install
        fi
    fi
}

###
# Establishes the connection to tailscale
#
# @return void
###
tailscale_connect() {
    if tailscale status >/dev/null 2>&1; then 
        log "Tailscale is already connected."
        return 0; 
    fi
    if sudo tailscale up --timeout 5s >/dev/null 2>&1; then
        log "Tailscale connected with existing authentication."
        return 0;
    fi
    local connected=false
    log "Generating new auth key..."
    local -a up_params=()
    if [ -n "$TAILSCALE_API_KEY" ]; then
        local auth_key
        if ! auth_key=$(tailscale_create_auth_key); then
            exit 1
        fi
        up_params+=("--auth-key=$auth_key")
    fi
    log "Authenticating with Tailscale..."
    if ! sudo tailscale up "${up_params[@]}"; then
        log_error "Failed to initiate tailscale connection."
        exit 1
    fi
    for _ in {1..15}; do
        if tailscale status >/dev/null 2>&1; then
            connected=true
            break
        fi
        sleep 1
    done
    if [ ! "$connected" = true ]; then
        log_error "Failed to connect Tailscale."
        exit 1
    fi
}

###
# Save the Tailscale IPv4 to the environment variable
###
tailscale_save_ip() {
    local tailscale_ip
    tailscale_ip=$(tailscale ip -4)
    if [[ ! $tailscale_ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
        log_error "Failed to detect the Tailnet IP"
        exit 1
    fi
    save_env TAILSCALE_IP "$tailscale_ip"
}

###
# Find and configure the device in Tailscale for the given IP
#
# @param $1 {string}    Tailscale IPv4
# @return   {void}
###
tailscale_configure_device() {
    local device device_id device_name expiry_disabled
    local max_attempts=12  # 12 attempts with 5 seconds between = 1 minute
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if device=$(tailscale_find_device "$TAILSCALE_IP") && [ -n "$device" ]; then
            device_name=$(echo "$device" | jq -r '.name')
            log "Tailscale device name: ${Purple}$device_name${COff}"
            expiry_disabled=$(echo "$device" | jq -r '.keyExpiryDisabled')
            if [ "$expiry_disabled" = true ]; then
                log "Key expiration is already disabled"
                return 0
            fi
            if ! device_id=$(echo "$device" | jq -r '.id'); then
                log_error "Could not extract id for tailscale device $device"
                exit 1
            fi
            if ! tailscale_disable_key_expiration "$device_id" >/dev/null; then
                exit 1
            fi
            log "Key expiration disabled for this device."
            return 0
        fi
        
        # Device not found yet
        if [ $attempt -lt $max_attempts ]; then
            log "Device with IP ${Purple}$TAILSCALE_IP${COff} not found yet, retrying in 5 seconds... (attempt $attempt/$max_attempts)"
            sleep 5
        fi
        
        ((attempt++))
    done
    
    # If we get here, we've exhausted all retry attempts
    log_error "Failed to find tailscale device with address: $TAILSCALE_IP"
    exit 1
}

tailscale_save_status() {
    local status_file="${PROJECT_ROOT%/}/.tailscale"
    jq -n --arg ip "$TAILSCALE_IP" --arg status "$1" '
    {
        ip: $ip,
        status: $status,
    }
    ' > "$status_file" || return 1
    log "Tailscale configuration cached to ${Cyan}$status_file${COff}"
}

tailscale_load_status() {
    local ip status_file="${PROJECT_ROOT%/}/.tailscale"
    if [ ! -f "$status_file" ]; then echo unknown; return 0; fi
    ip=$(jq -r '.ip' "$status_file") || return 1
    if [ "$ip" != "$TAILSCALE_IP" ]; then echo unknown; return 0; fi
    jq -r '.status' "$status_file" || return 1
}

###
# Prepare Tailscale connection for deployment and save Tailnet IP
#
# @return void
###
configure_tailscale() {
    local status status_file="${PROJECT_ROOT%/}/.tailscale"
    log_header "Configuring Tailscale"

    tailscale_check_installed || return 1
    tailscale_connect || return 1
    tailscale_save_ip || return 1
    status=$(tailscale_load_status) || {
        log_warn "Failed to load cached tailscale status from '$status_file'"
    }
    if [ "$status" != configured ]; then
        tailscale_configure_device || return 1
    fi
    tailscale_save_status configured || {
        log_warn "Failed to cache tailscale status to '$status_file'"
    }
    log "Tailscale is connected. Address: ${Cyan}$TAILSCALE_IP${COff}"
}