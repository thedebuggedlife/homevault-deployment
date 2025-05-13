if [ -n "$__LIB_CLOUDFLARE" ]; then return 0; fi

__LIB_CLOUDFLARE=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

CLOUDFLARE_API_BASE_URL=https://api.cloudflare.com/client/v4

################################################################################
#                            CLOUDFLARE API CLIENT

# Makes a request to Cloudflare API
# Params:   $1 HTTP Method
#           $2 API Path
#           $3 Request body [Optional]
# Returns:  Body of the response
cloudflare_rest_call() {
    local response
    if ! response=$(rest_call "$1" "$CLOUDFLARE_API_BASE_URL/$2" -h "Authorization: Bearer ${CF_DNS_API_TOKEN}" -b "$3"); then
        return 1
    fi
    echo "$response"
}

cloudflare_get_account_id() {
    local response account_id
    if ! response=$(cloudflare_rest_call GET accounts); then
        return 1
    fi
    account_id=$(echo "$response" | jq -r '.result[0].id')
    if [[ -z "$account_id" || "$account_id" = "null" ]]; then
        log_error "Failed to retrieve cloudflare account ID"
        return 1
    fi
    echo "$account_id"
}

# Gets the ID of a zone by domain name
# Params:   $1 Domain name
# Returns:  The ID of the zone
cloudflare_get_zone_id() {
    local domain_name=$1
    local response zone_id
    if ! response=$(cloudflare_rest_call "GET" "zones?name=${domain_name}"); then
        return 1
    fi
    zone_id=$(echo "$response" | jq -r '.result[0].id')
    if [ -z "$zone_id" ] || [ "$zone_id" = "null" ]; then
        log_error "Unable to retrieve zone ID for domain $domain_name"
        return 1
    fi
    echo "$zone_id"
}

# Gets a DNS record by name
# Params:   $1 Zone ID
#           $2 Name of the record
# Returns:  DNS record object
cloudflare_get_record() {
    local zone_id=$1
    local name=$2
    local response
    if ! response=$(cloudflare_rest_call GET "zones/$zone_id/dns_records?&name=$name"); then
        return 1
    fi
    echo "$response"
}

###
# Adds or updates a DNS record in the cloudflare account
#
# @param {string} zone_id   - The ID of the Zone (domain) where the record will be created
# @param {string} type      - The type of record to create (e.g. A, AAA, CNAME)
# @param {string} name      - The name of the DNS record (e.g. 'www')
# @param {string} content   - The content for the DNS record (e.g. 10.10.10.10)
# @param {boolean} proxied  - (optional) Whether the record should get CloudFlare proxy logic [Default=true]
# @return void
###
cloudflare_add_or_update_record() {
    local zone_id=$1
    local type=$2
    local name=$3
    local content=$4
    local proxied=${5:-false}
    local existing record_id json_payload
    if ! existing=$(cloudflare_get_record "$zone_id" "$name"); then
        exit 1
    fi
    record_id=$(echo "$existing" | jq -r '.result[0].id // empty')
    json_payload=$(jq -n \
        --arg type "$type" \
        --arg name "$name" \
        --arg content "$content" \
        --arg comment "SMTP2GO verification record" \
        --argjson proxied "$proxied" \
        '{type: $type, name: $name, content: $content, proxied: $proxied, comment: $comment}')
    local response
    if [ -n "$record_id" ]; then
        echo -e "Updating existing ${Cyan}$type${COff} record for ${Purple}$name${COff}..."
        if ! response=$(cloudflare_rest_call PUT "zones/$zone_id/dns_records/$record_id" "$json_payload"); then
            exit 1
        fi
        if echo "$response" | jq -e '.success' >/dev/null; then
            echo "Record updated successfully."
        else
            log_error "Failed to update record: $response"
            exit 1
        fi
    else
        echo -e "Creating new ${Cyan}$type${COff} record for ${Purple}$name${COff}..."
        if ! response=$(cloudflare_rest_call POST "zones/$zone_id/dns_records" "$json_payload"); then
            exit 1
        fi
        if echo "$response" | jq -e '.success' >/dev/null; then
            echo "Record created successfully."
        else
            log_error "Failed to create record: $response"
            exit 1
        fi
    fi
}

###
# Retrieves a cloudflare tunnel by name
#
# @param {string} account_id    - The cloudflare account id where the tunnel exists
# @param {string} tunnel_name   - The name of the tunnel being searched for
# @return {json}                - The tunnel, if found, otherwise empty
###
cloudflare_get_tunnel() {
    local account_id=$1
    local tunnel_name=$2
    local response tunnel
    if ! response=$(cloudflare_rest_call GET "accounts/$account_id/cfd_tunnel"); then
        return 1
    fi
    tunnel=$(echo "$response" | jq -r --arg name "$tunnel_name" 'limit(1; .result[] | select(.name == $name and ((.deleted_at // "") == "")))')
    if [[ -z "$tunnel" || "$tunnel" = "null" ]]; then
        echo ""
    else
        echo "$tunnel"
    fi
}

###
# Creates a new cloudflare tunnel
#
# @param {string} account_id    - The cloudflare account id where the tunnel will be created
# @param {string} tunnel_name   - The name for the tunnel
# @return {json}                - The tunnel that was created
###
cloudflare_create_tunnel() {
    local account_id=$1
    local tunnel_name=$2
    local body response tunnel
    body=$(jq -n --arg name "$tunnel_name" '{"name": $name, "config_src": "cloudflare"}')
    if ! response=$(cloudflare_rest_call POST "accounts/$account_id/cfd_tunnel" "$body"); then
        return 1
    fi
    tunnel=$(echo "$response" | jq '.result')
    if [[ -z "$tunnel" || "$tunnel" = "null" ]]; then
        log_error "Failed to create cloudflared tunnel"
        return 1
    fi
    echo "$tunnel"
}

###
# Gets a token that can be used to connect to a given cloudflare tunnel
#
# @param {string} account_id    - The cloudflare account id where the tunnel exists
# @param {string} tunnel_id     - The cloudflare tunnel id the token is for
# @return {string}              - The token for the token
###
cloudflare_get_tunnel_token() {
    local account_id=$1
    local tunnel_id=$2
    local response secret
    if ! response=$(cloudflare_rest_call GET "accounts/$account_id/cfd_tunnel/$tunnel_id/token"); then
        return 1
    fi
    secret=$(echo "$response" | jq -r '.result')
    if [[ -z "$secret" || "$secret" = "null" ]]; then
        log_error "Failed to retrieve cloudflare tunnel token"
        return 1
    fi
    echo "$secret"
}

################################################################################
#                          CLOUDFLARE SETUP STEPS

###
# Prepares a Cloudflare tunnel to be used by the cloudflared service
#
# @return void
###
configure_cloudflare_tunnel() {
    log_header "Configuring CloudFlare Tunnel"

    if [ -z "$CF_TUNNEL_NAME" ]; then
        log_error "Please specify a value for 'CF_TUNNEL_NAME' in the '$ENV_FILE' file."
        exit 1
    fi
    local token_file=${SECRETS_PATH}cloudflare_tunnel_token
    if [ -n "$CF_TUNNEL_ID" ] && [ -f "$token_file" ]; then
        echo "Cloudflare tunnel appears to be already configured." >&2
        if [ "$USE_DEFAULTS" = "true" ]; then return 0; fi
        local user_input=N
        if [ "$UNATTENDED" != "true" ]; then
            read -p "Do you want to reconfigure the Cloudflare tunnel information? [y/N] " user_input </dev/tty
            user_input=${user_input:-N}
        fi
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    local account_id tunnel tunnel_id token
    if ! account_id=$(cloudflare_get_account_id); then
        exit 1
    fi
    tunnel=$(cloudflare_get_tunnel "$account_id" "$CF_TUNNEL_NAME")
    if [ -z "$tunnel" ]; then
        echo -e "Cloudflare tunnel ${Purple}$CF_TUNNEL_NAME${COff} does not exist. Creating one..."
        if ! tunnel=$(cloudflare_create_tunnel "$account_id" "$CF_TUNNEL_NAME"); then
            exit 1
        fi
    else
        echo -e "Cloudflare tunnel ${Purple}$CF_TUNNEL_NAME${COff} already exists."
    fi
    tunnel_id=$(echo "$tunnel" | jq -r '.id')
    if ! token=$(cloudflare_get_tunnel_token "$account_id" "$tunnel_id"); then
        exit 1
    fi
    save_env "CF_TUNNEL_ID" "$tunnel_id"
    echo -e "Saving tunnel credentials to ${Cyan}$token_file${COff}..."
    printf "%s" "$token" >"$token_file"
}