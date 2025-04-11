if [ -n "$__LIB_SMTP2GO" ]; then return 0; fi

__LIB_SMTP2GO=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=./http.sh
source "$PROJECT_ROOT/lib/http.sh"
#shellcheck source=./cloudflare.sh
source "$PROJECT_ROOT/lib/cloudflare.sh"

SMTP2GO_API_BASE_URL=https://api.smtp2go.com/v3

################################################################################
#                              SMTP2GO API CLIENT

# Makes a request to SMTP2GO API
# Params:   $1 HTTP Method
#           $2 API Path
#           $3 Request body [Optional]
# Returns:  Body of the response
smtp2go_rest_call() {
    local response
    if ! response=$(rest_call $1 "$SMTP2GO_API_BASE_URL/$2" "X-Smtp2go-Api-Key: $SMTP2GO_API_KEY" "$3"); then
        return 1
    fi
    echo "$response"
}

# Adds a verified domain
# Params:   $1 Domain name
# Returns:  The domain object
smtp2go_add_domain() {
    local domain_name=$1
    echo -e "Attempting to create domain ${UPurple}$domain_name${COff} via SMTP2GO API..." >&2
    local response domain_obj
    if ! response=$(smtp2go_rest_call POST domain/add "{\"auto_verify\": false, \"domain\": \"$domain_name\"}"); then
        return 1
    fi
    domain_obj=$(echo "$response" | jq -r --arg domain "$domain_name" '.data.domains[] | select(.domain.fulldomain == $domain)')
    if [ -z "$domain_obj" ]; then
        log_error "Could not extract domain from response: $response"
        return 1
    fi
    echo "$domain_obj"
}

# Checks if validation of a domain has succeeded
# Params:   $1 Domain name
#           $2 Number of seconds to wait [Default=15]
smtp2go_validate_domain() {
    local domain_name=$1
    local wait_sec=${2:-15}
    local response
    for _ in $(seq 1 "$wait_sec"); do
        echo -n "Waiting for 5s for DNS records to propagate..."
        sleep 5
        if ! response=$(smtp2go_rest_call POST domain/verify "{\"domain\":\"$domain_name\"}"); then
            exit 1
        fi
        local domain dkim return_path
        domain=$(echo "$response" | jq -r --arg domain "$domain_name" '.data.domains[] | select(.domain.fulldomain == $domain)')
        dkim=$(echo "$domain" | jq -r '.domain.dkim_verified')
        return_path=$(echo "$domain" | jq -r '.domain.rpath_verified')
        # link=$(echo "$domain" | jq -r '.trackers[0].cname_verified')
        if [ "$dkim" = "true" ] && [ "$return_path" = "true" ]; then
            echo -e "\nDomain ${UPurple}$domain_name${COff} is fully verified"
            return 0
        fi
        echo " domain has not been validated yet."
    done
    log_error "Failed to verify $domain_name: $response"
    exit 1
}

# Adds an SMTP user to the account
# Params:   $1 Username
# Returns:  User object
smtp2go_add_user() {
    local username=$1
    local password json_payload user response
    password=$(tr -cd '[:alnum:]' </dev/urandom | fold -w 20 | head -n 1 | tr -d '\n')
    json_payload=$(jq -n \
        --arg username "$username" \
        --arg password "$password" \
        --arg description "Email sender for self-hosted applications" \
        '{username: $username, email_password: $password, description: $description}')
    echo -e "Creating user ${Purple}$username${COff} in SMTP2GO account" >&2
    if ! response=$(smtp2go_rest_call POST users/smtp/add "$json_payload"); then
        return 1
    fi
    user=$(echo "$response" | jq -r --arg username "$username" '.data.results[] | select(.username == $username)')
    if [ -z "$user" ]; then
        log_error "Failed to create user: $response"
        return 1
    fi
    echo "$user"
}

################################################################################
#                             SMTP2GO SETUP STEPS

###
# Create the necessary DNS records as specified by SMTP2GO
#
# @param {json} domain_obj - Domain object as returned by the SMTP2GO API
# @return void
###
configure_smtp_domain_records() {
    local domain_obj=$1
    local zone_id name content
    if ! zone_id=$(cloudflare_get_zone_id "$CF_DOMAIN_NAME"); then
        exit 1
    fi
    name=$(echo "$domain_obj" | jq -r '.domain.dkim_selector')
    content=$(echo "$domain_obj" | jq -r '.domain.dkim_expected')
    if [ -z "$name" ] || [ -z "$content" ]; then
        log_error "Could not find DNS record name or content for DKIM"
        exit 1
    fi
    cloudflare_add_or_update_record "$zone_id" "CNAME" "$name._domainkey.$CF_DOMAIN_NAME" $content
    name=$(echo "$domain_obj" | jq -r '.domain.rpath_selector')
    content=$(echo "$domain_obj" | jq -r '.domain.rpath_expected')
    if [ -z "$name" ] || [ -z "$content" ]; then
        log_error "Could not find DNS record name or content for Return Path"
        exit 1
    fi
    cloudflare_add_or_update_record "$zone_id" "CNAME" "$name.$CF_DOMAIN_NAME" "$content"
    name=$(echo "$domain_obj" | jq -r '.trackers[0].subdomain')
    content=$(echo "$domain_obj" | jq -r '.trackers[0].cname_expected')
    if [ -z "$name" ] || [ -z "$content" ]; then
        log_error "Could not find DNS record name or content for Link"
        exit 1
    fi
    cloudflare_add_or_update_record "$zone_id" "CNAME" "$name.$CF_DOMAIN_NAME" "$content"
}

###
# Configure the domain and validate it has been verified by SMTP2GO to send emails
#
# @return void
###
configure_smtp_domain() {
    if [ "$SMTP2GO_DOMAIN_VALIDATED" = "true" ]; then
        echo "Domain has been previously verified."
        if [ "$RESUME" = "true" ]; then return 0; fi
        local user_input=N
        if [ "$UNATTENDED" != "true" ]; then
            read -p "Do you want to revalidate the domain configuration? [y/N]" user_input </dev/tty
            user_input=${user_input:-N}
        fi
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    if [ -z "$CF_DOMAIN_NAME" ] || [ -z "$CF_DNS_API_TOKEN" ] || [ -z "$SMTP2GO_API_KEY" ]; then
        log_error "Error: Please set CF_DOMAIN_NAME, CF_DNS_API_TOKEN and SMTP2GO_API_KEY values in the '$ENV_FILE' file."
        exit 1
    fi
    local response domain dkim return_path
    if ! response=$(smtp2go_rest_call POST domain/view); then
        exit 1
    fi
    domain=$(echo "$response" | jq -r --arg domain "$CF_DOMAIN_NAME" '.data.domains[] | select(.domain.fulldomain == $domain)')
    if [ -z "$domain" ]; then
        if ! domain=$(smtp2go_add_domain "$CF_DOMAIN_NAME"); then
            exit 1
        fi
    fi
    dkim=$(echo "$domain" | jq -r '.domain.dkim_verified')
    return_path=$(echo "$domain" | jq -r '.domain.rpath_verified')
    # link=$(echo "$domain" | jq -r '.trackers[0].cname_verified')
    if [ "$dkim" = "true" ] && [ "$return_path" = "true" ]; then
        echo -e "Domain ${UPurple}$CF_DOMAIN_NAME${COff} is fully verified"
    else
        echo -e "Domain ${UPurple}$CF_DOMAIN_NAME${COff} is not fully verified"
        configure_smtp_domain_records "$domain"
        if [ $? -ne 0 ]; then
            return 1
        fi
        smtp2go_validate_domain "$CF_DOMAIN_NAME"
        if [ $? -ne 0 ]; then
            exit 1
        fi
    fi
    save_env SMTP2GO_DOMAIN_VALIDATED "true"
}

###
# Create a user that can send mail through SMTP2GO. Save the credentials to .env
#
# @return void
###
configure_smtp_user() {
    if [ -n "$SMTP_PASSWORD" ]; then
        echo "SMTP2GO user appears to already be configured."
        if [ "$RESUME" = "true" ]; then return 0; fi
        local user_input=N
        if [ "$UNATTENDED" != "true" ]; then
            read -p "Do you want to validate or re-create the user with SMTP2GO? [y/N] " user_input </dev/tty
            user_input=${user_input:-N}
        fi
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    if [ -z "$SMTP_USERNAME" ] || [ -z "$SMTP2GO_API_KEY" ]; then
        log_error "Please set SMTP_USERNAME and SMTP2GO_API_KEY values in the '$ENV_FILE' file."
        exit 1
    fi
    local username="$SMTP_USERNAME"
    local response user password
    if ! response=$(smtp2go_rest_call POST users/smtp/view); then
        exit 1
    fi
    user=$(echo "$response" | jq -r --arg username "$username" '.data.results[] | select(.username == $username)')
    if [ -z "$user" ]; then
        echo "User ${Purple}$username${COff} does not exist in SMTP2GO account. Creating user..."
        if ! user=$(smtp2go_add_user "$username"); then
            exit 1
        fi
    fi
    password=$(echo "$user" | jq -r '.email_password')
    save_env SMTP_PASSWORD "${password}"
}