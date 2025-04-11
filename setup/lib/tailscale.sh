if [ -n "$__LIB_TAILSCALE" ]; then return 0; fi

__LIB_TAILSCALE=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

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
    if ! response=$(rest_call $1 "$TAILSCALE_API_BASE_URL/$2" "Authorization: Bearer ${TAILSCALE_API_KEY}" "$3"); then
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
    tailscale_rest_call POST "device/${device_id}/key" "$body"
    if [ $? -ne 0 ]; then
        return 1
    fi
}

################################################################################
#                          TAILSCALE SETUP STEPS

###
# Checks that tailscale is installed
#
# @return void
###
check_tailscale() {
    if ! command -v tailscale >/dev/null 2>&1; then
        echo -e "\n${Yellow}Tailscale is not installed.${COff}"
        local user_input=Y
        if [ "$UNATTENDED" != "true" ]; then
            read -p "Do you want to install tailscale? [Y/n] " user_input </dev/tty
            user_input=${user_input:-Y}
        fi
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            echo "Installing tailscale..."
            if ! curl -fsSL https://tailscale.com/install.sh | sh >/dev/null; then
                log_error "Failed to install tailscale"
                exit 1
            else
                echo -e "\n✅ Tailscale installation completed successfully\n"
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
connect_tailscale() {
    if tailscale status >/dev/null 2>&1; then return 0; fi
    local connected=false
    echo "Connecting to Tailscale..."
    local -a up_params=()
    if [ -n "$TAILSCALE_API_KEY" ]; then
        local auth_key
        if ! auth_key=$(tailscale_create_auth_key); then
            exit 1
        fi
        up_params+=("--auth-key=$auth_key")
    fi
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
# Prepare Tailscale connection for deployment and save Tailnet IP
#
# @return void
###
configure_tailscale() {
    check_tailscale
    if [ $? -ne 0 ]; then
        return 1
    fi
    connect_tailscale
    if [ $? -ne 0 ]; then
        return 1
    fi
    sudo systemctl enable --now tailscaled
    if [ $? -ne 0 ]; then
        log_error "Failed to enable tailscale auto-start"
        exit 1
    fi
    local tailscale_ip
    tailscale_ip=$(tailscale ip -4)
    if [ -z "$tailscale_ip" ]; then
        log_error "Failed to detect the Tailnet IP"
        exit 1
    fi
    echo "Tailscale is connected."
    if [[ -z "$TAILSCALE_IP" && -n "$TAILSCALE_API_KEY" ]]; then
        local device
        if ! device=$(tailscale_find_device "$tailscale_ip") || [ -z "$device" ]; then
            log_error "Failed to find tailscale device with address: $tailscale_ip"
            exit 1
        fi
        local device_id
        if ! device_id=$(echo "$device" | jq -r '.id'); then
            log_error "Could not extract id for tailscale device $device"
            exit 1
        fi
        if ! tailscale_disable_key_expiration "$device_id" >/dev/null; then
            exit 1
        fi
        echo -e "Key expiration disabled for ${Cyan}$tailscale_ip${COff}"
    fi
    save_env TAILSCALE_IP "$tailscale_ip"
}