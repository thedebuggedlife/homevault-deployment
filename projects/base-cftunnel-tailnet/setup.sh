GH_IO_BASE_URL=https://thedebuggedlife.github.io/selfhost-bootstrap/appdata
GH_RAW_BASE_URL=https://raw.githubusercontent.com/thedebuggedlife/selfhost-bootstrap/refs/heads/main/projects/base-cftunnel-tailnet

save_env() {
    local env_variable=$1
    local env_value=$2
    echo "Saving '$env_variable' in '$ENV_FILE'"
    sed -i -E "s|^($env_variable)=.*|\1=${env_value}|" "$ENV_FILE"
    eval "$env_variable=$env_value"
}

save_env_id() {
    local env_variable=$1
    local id_length=${2:-20}
    local env_value="${!env_variable}"
    if [ -z "$env_value" ]; then
        env_value=$(tr -cd '[:alnum:]' </dev/urandom | fold -w "${id_length}" | head -n 1 | tr -d '\n')
    fi
    save_env "$env_variable" "$env_value"
}

save_env_secret() {
    local secret_filename=$1
    local env_variable=$2
    if [ ! -n "${!env_variable}" ]; then
        echo "Missing value for '$env_variable' in '$ENV_FILE'"
        exit 1
    fi
    echo "Creating secret file '$secret_filename'"
    printf "%s" "${!env_variable}" >"$secret_filename"
}

create_secret() {
    local secret_filename=$1
    local SECRET_LENGTH=${2:-40}
    if [ -f "$secret_filename" ]; then
        echo "Secret file '$secret_filename' already exists."
    else
        echo "Creating secret file '$secret_filename'"
        tr -cd '[:alnum:]' </dev/urandom | fold -w "${SECRET_LENGTH}" | head -n 1 | tr -d '\n' >$secret_filename
    fi
}

create_password_digest_pair() {
    local pair_name=$1
    local password_length=${2:-64}
    local password_filename="${pair_name}_password"
    local digest_filename="${pair_name}_digest"
    if [ -f "$password_filename" ] || [ -f "$digest_filename" ]; then
        echo "Either password or digest file for pair '$pair_name' already exists."
        return 1
    fi
    local output=$(docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --random --random.length $password_length --random.charset alphanumeric)
    local password_value=$(echo "$output" | awk '/Random Password:/ {print $3}')
    local digest_value=$(echo "$output" | awk '/Digest:/ {print $2}')
    if [ -z "$password_value" ] || [ -z "$digest_value" ]; then
        echo "Error: Password or digest extraction failed."
        exit 1
    fi
    echo "Creating password file '$password_filename'"
    printf "%s" "$password_value" >"$password_filename"
    echo "Creating digest file '$digest_filename'"
    printf "%s" "$digest_value" >"$digest_filename"
}

ask_for_env() {
    local env_variable=$1
    local prompt_text=$2
    local use_default=${3:-true}
    local env_value
    while true; do
        if [ "$use_default" != "true" ] || [ -z "${!env_variable}" ]; then
            read -p "Enter value for $prompt_text: " env_value </dev/tty
        else
            if [ "$RESUME" = "true" ]; then
                env_value=${!env_variable}
            else
                read -p "Enter value for $prompt_text [${!env_variable}]: " env_value </dev/tty
                env_value=${env_value:-${!env_variable}}
            fi
        fi
        if [ -n "$env_value" ]; then
            break
        fi
        echo "Empty value is not allowed. Please try again."
    done
    save_env $env_variable $env_value
}

ask_for_secret() {
    local secret_filename=$1
    local env_variable=$2
    local prompt_text=$3
    if [ -n "${!env_variable}" ]; then
        echo "Secret '$env_variable' already defined in '$ENV_FILE'"
        return 1
    fi
    ask_for_env $env_variable "$prompt_text"
    echo "Creating secret file '$secret_filename'"
    printf "%s" "${!env_variable}" >"$secret_filename"
}

create_rsa_keypair() {
    local private_key=$1
    local public_key=$2
    local key_length=${3:-2048}
    if [ -f "$private_key" ]; then
        echo "Private key '$private_key' already exists." >&2
    else
        echo "Generating private key '$private_key'." >&2
        openssl genrsa -out "$private_key" $key_length
        if [ $? -ne 0 ]; then
            echo "Failed to generate private key '$private_key'" >&2
            exit 1
        fi
    fi
    if [ -f "$public_key" ]; then
        echo "Public key '$public_key' already exists." >&2
    else
        echo "Generating public key '$public_key'." >&2
        openssl rsa -in "$private_key" -outform PEM -pubout -out "$public_key"
        if [ $? -ne 0 ]; then
            echo "Failed to generate public key '$public_key'" >&2
            exit 1
        fi
    fi
}

ask_for_variables() {
    if [ -n "$APPDATA_OVERRIDE" ]; then
        save_env APPDATA_LOCATION "${APPDATA_OVERRIDE%/}"
    else
        ask_for_env APPDATA_LOCATION "Application Data folder"
    fi
    ask_for_env TZ "Server Timezone"
    ask_for_env CF_ADMIN_EMAIL "Cloudflare Administrator Email"
    ask_for_env CF_DNS_API_TOKEN "Cloudflare DNS API Token"
    ask_for_env CF_DOMAIN_NAME "Domain Name For Server"
    save_env CF_DOMAIN_CN "\"$(echo "$CF_DOMAIN_NAME" | sed 's/^/dc=/' | sed 's/\./,dc=/g')\""
    ask_for_env CF_TUNNEL_NAME "Cloudflare Tunnel Name"
    ask_for_env SMTP2GO_API_KEY "SMTP2GO API Key"
    if [ -z "$SMTP_SENDER" ]; then
        save_env SMTP_SENDER "noreply@${CF_DOMAIN_NAME}"
    fi
    ask_for_env SMTP_SENDER "SMTP Email From"
    if [ "$USE_SMTP2GO" != "true" ]; then
        ask_for_env SMTP_USERNAME "SMTP Server Username"
        ask_for_env SMTP_PASSWORD "SMTP Server Password"
        ask_for_env SMTP_SERVER "SMTP Server Address"
        ask_for_env SMTP_PORT "SMTP Server Port"
    else
        if [ -z "$SMTP_USERNAME" ]; then
            save_env SMTP_USERNAME "selfhost@${CF_DOMAIN_NAME}"
        fi
        ask_for_env SMTP_USERNAME "SMTP Server Username"
    fi
    ask_for_env AUTHELIA_THEME "dark"
    ask_for_env LLDAP_ADMIN_PASSWORD "LLDAP Administrator Password"
    ask_for_env PORTAINER_ADMIN_PASSWORD "Portainer Administrator Password"
}

save_secrets() {
    local 
    if [ ! -d "$SECRETS_PATH" ]; then
        sudo mkdir -p "$SECRETS_PATH"
        sudo chown $USER:docker "$SECRETS_PATH"
    fi
    save_env_id OIDC_IMMICH_CLIENT_ID
    save_env_id OIDC_GRAFANA_CLIENT_ID
    save_env_id OIDC_NEXTCLOUD_CLIENT_ID
    save_env_secret "${SECRETS_PATH}cloudflare_dns_api_token" CF_DNS_API_TOKEN
    save_env_secret "${SECRETS_PATH}smtp_password" SMTP_PASSWORD
    save_env_secret "${SECRETS_PATH}ldap_admin_password" LLDAP_ADMIN_PASSWORD
    save_env_secret "${SECRETS_PATH}portainer_admin_password" PORTAINER_ADMIN_PASSWORD
    create_secret "${SECRETS_PATH}authelia_session_secret"
    create_secret "${SECRETS_PATH}authelia_storage_encryption_key"
    create_secret "${SECRETS_PATH}ldap_jwt_secret"
    create_secret "${SECRETS_PATH}ldap_key_seed"
    create_secret "${SECRETS_PATH}ldap_authelia_password"
    create_secret "${SECRETS_PATH}oidc_hmac_secret"
    create_password_digest_pair "${SECRETS_PATH}oidc_immich"
    create_password_digest_pair "${SECRETS_PATH}oidc_nextcloud"
    create_password_digest_pair "${SECRETS_PATH}oidc_grafana"
    create_rsa_keypair "${SECRETS_PATH}oidc_jwks_key" "${SECRETS_PATH}oidc_jwks_public"
    if [ $? -ne 0 ]; then
        return 1
    fi
    chmod 644 "${SECRETS_PATH}"*
}

create_appdata_location() {
    if [ ! -d "$APPDATA_LOCATION" ]; then
        sudo mkdir -p "$APPDATA_LOCATION"
        sudo chown $USER:docker "$APPDATA_LOCATION"
    fi
    SECRETS_PATH="${APPDATA_LOCATION%/}/secrets/"
}

download_appdata() {
    local appdata_files=(
        "${APPDATA_LOCATION%/}/authelia/configuration.yml"
        "${APPDATA_LOCATION%/}/traefik/traefik.yml"
    )
    local missing_files=false
    for path in "${appdata_files[@]}"; do
        if [ ! -f "$path" ] || [ ! -s "$path" ]; then
            echo "File '$path' is missing or empty."
            missing_files=true
        fi
    done
    if [ "$missing_files" != true ]; then
        return 0
    fi
    local user_input
    read -p "Do you want to download the missing configuration files? [Y/n] " user_input </dev/tty
    user_input=${user_input:-Y}
    if [[ "$user_input" =~ ^[Yy]$ ]]; then
        echo "Downloading appdata..." >&2
        wget -qO- $GH_IO_BASE_URL/base-cftunnel-tailnet.zip \
            | busybox unzip -n - -d "$APPDATA_LOCATION" 2>&1 \
            | grep -E "creating:|inflating:" \
            | awk -F': ' '{print $2}' \
            | while read -r path; do
                echo "Changing owner of: '${APPDATA_LOCATION%/}/$path'"
                chown $USER:docker "${APPDATA_LOCATION%/}/$path"
              done
        if [ $? -ne 0 ]; then
            return 1
        fi
    else
        abort_install
        return 1
    fi
}

rest_call() {
    local method=$1
    local url=$2
    local auth=$3
    local body=$4
    # Debug
    # echo "Calling: $method $url $body" >&2
    # Make the curl request.
    local response
    if [ -n "$body" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            --request $method \
            --url $url \
            --header "Content-Type: application/json" \
            --header "$auth" \
            --header "accept: application/json" \
            --data "$body")
    else
        response=$(curl -s -w "\n%{http_code}" \
            --request $method \
            --url $url \
            --header "$auth" \
            --header "accept: application/json")
    fi
    # Separate the body and the HTTP status code.
    local http_status=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    # Debug
    # echo "HTTP Status: $http_status" >&2
    # echo -e "Response Body:\n$(echo $response | jq .)" >&2
    # Check if the status code indicates success (2XX)
    if [[ "$http_status" =~ ^2 ]]; then
        echo "$response"
    else
        echo "Request to $method $url failed with $http_status: $response" >&2
        return 1
    fi
}

smtp2go_rest_call() {
    local response=$(rest_call $1 https://api.smtp2go.com/v3/$2 "X-Smtp2go-Api-Key: $SMTP2GO_API_KEY" "$3")
    if [ $? -ne 0 ]; then
        return 1
    fi
    echo "$response"
}

cloudflare_rest_call() {
    local response=$(rest_call $1 https://api.cloudflare.com/client/v4/$2 "Authorization: Bearer ${CF_DNS_API_TOKEN}" "$3")
    if [ $? -ne 0 ]; then
        return 1
    fi
    echo "$response"
}

smtp2go_add_domain() {
    echo "Attempting to create domain '$CF_DOMAIN_NAME' via SMTP2GO API..." >&2
    local response=$(smtp2go_rest_call POST domain/add "{\"auto_verify\": false, \"domain\": \"$CF_DOMAIN_NAME\"}")
    if [ $? -ne 0 ]; then
        return 1
    fi
    local domain=$(echo "$response" | jq -r --arg domain "$CF_DOMAIN_NAME" '.data.domains[] | select(.domain.fulldomain == $domain)')
    if [ -z "$domain" ]; then
        echo "Could not extract domain from response: $response" >&2
        return 1
    fi
    echo "$domain"
}

cloudflare_get_zone_id() {
    local response=$(cloudflare_rest_call "GET" "zones?name=${CF_DOMAIN_NAME}")
    if [ $? -ne 0 ]; then
        return 1
    fi
    local zone_id=$(echo "$response" | jq -r '.result[0].id')
    if [ -z "$zone_id" ] || [ "$zone_id" == "null" ]; then
        echo "Error: Unable to retrieve zone ID for domain $CF_DOMAIN_NAME" >&2
        return 1
    fi
    echo "$zone_id"
}

cloudflare_get_record() {
    local zone_id=$1
    local name=$2
    local response=$(cloudflare_rest_call GET "zones/$zone_id/dns_records?&name=$name")
    if [ $? -ne 0 ]; then
        return 1
    fi
    echo "$response"
}

cloudflare_add_or_update_record() {
    local zone_id=$1
    local type=$2
    local name=$3
    local content=$4
    local proxied=${5:-false}
    local existing=$(cloudflare_get_record $zone_id "$name.$CF_DOMAIN_NAME")
    if [ $? -ne 0 ]; then
        return 1
    fi
    local record_id=$(echo "$existing" | jq -r '.result[0].id // empty')
    local json_payload=$(jq -n \
        --arg type "$type" \
        --arg name "$name" \
        --arg content "$content" \
        --arg comment "SMTP2GO verification record" \
        --argjson proxied $proxied \
        '{type: $type, name: $name, content: $content, proxied: $proxied, comment: $comment}')
    local response
    if [ -n "$record_id" ]; then
        echo "Updating existing $type record for $name..." >&2
        response=$(cloudflare_rest_call PUT "zones/$zone_id/dns_records/$record_id" "$json_payload")
        if [ $? -ne 0 ]; then
            return 1
        fi
        if echo "$response" | jq -e '.success' >/dev/null; then
            echo "Record updated successfully." >&2
        else
            echo "Failed to update record: $response" >&2
            return 1
        fi
    else
        echo "Creating new $type record for $name..." >&2
        response=$(cloudflare_rest_call POST "zones/$zone_id/dns_records" "$json_payload")
        if [ $? -ne 0 ]; then
            return 1
        fi
        if echo "$response" | jq -e '.success' >/dev/null; then
            echo "Record created successfully." >&2
        else
            echo "Failed to create record: $response" >&2
            return 1
        fi
    fi
}

cloudflare_configure() {
    local domain=$1 # as returned by SMTP2GO
    local zone_id=$(cloudflare_get_zone_id)
    if [ $? -ne 0 ]; then
        return 1
    fi
    local name=$(echo "$domain" | jq -r '.domain.dkim_selector')
    local content=$(echo "$domain" | jq -r '.domain.dkim_expected')
    if [ -z "$name" ] || [ -z "$content" ]; then
        echo "Could not find DNS record name or content for DKIM" >&2
        return 1
    fi
    cloudflare_add_or_update_record $zone_id "CNAME" "$name._domainkey" $content
    if [ $? -ne 0 ]; then
        return 1
    fi
    name=$(echo "$domain" | jq -r '.domain.rpath_selector')
    content=$(echo "$domain" | jq -r '.domain.rpath_expected')
    if [ -z "$name" ] || [ -z "$content" ]; then
        echo "Could not find DNS record name or content for Return Path" >&2
        return 1
    fi
    cloudflare_add_or_update_record $zone_id "CNAME" $name $content
    if [ $? -ne 0 ]; then
        return 1
    fi
    name=$(echo "$domain" | jq -r '.trackers[0].subdomain')
    content=$(echo "$domain" | jq -r '.trackers[0].cname_expected')
    if [ -z "$name" ] || [ -z "$content" ]; then
        echo "Could not find DNS record name or content for Link" >&2
        return 1
    fi
    cloudflare_add_or_update_record $zone_id "CNAME" $name $content
    if [ $? -ne 0 ]; then
        return 1
    fi
}

smtp2go_validate_domain() {
    local response
    for i in {1..15}; do
        echo "Waiting for 5s for DNS records to propagate..." >&2
        sleep 5
        response=$(smtp2go_rest_call POST domain/verify "{\"domain\":\"$CF_DOMAIN_NAME\"}")
        if [ $? -ne 0 ]; then
            return 1
        fi
        local domain=$(echo "$response" | jq -r --arg domain "$CF_DOMAIN_NAME" '.data.domains[] | select(.domain.fulldomain == $domain)')
        local dkim=$(echo "$domain" | jq -r '.domain.dkim_verified')
        local return_path=$(echo "$domain" | jq -r '.domain.rpath_verified')
        local link=$(echo "$domain" | jq -r '.trackers[0].cname_verified')
        if [ "$dkim" = "true" ] && [ "$return_path" = "true" ]; then
            echo "Domain $CF_DOMAIN_NAME is fully verified" >&2
            return 0
        fi
        echo "Domain has not been validated yet." >&2
    done
    echo "Failed to verify $CF_DOMAIN_NAME: $response" >&2
    return 1
}

smtp2go_add_user() {
    local username=$1
    local password=$(tr -cd '[:alnum:]' </dev/urandom | fold -w 20 | head -n 1 | tr -d '\n')
    local json_payload=$(jq -n \
        --arg username "$username" \
        --arg password "$password" \
        --arg description "Email sender for self-hosted applications" \
        '{username: $username, email_password: $password, description: $description}')
    echo "Creating user '$username' in SMTP2GO account" >&2
    local response=$(smtp2go_rest_call POST users/smtp/add "$json_payload")
    local user=$(echo "$response" | jq -r --arg username "$username" '.data.results[] | select(.username == $username)')
    if [ -z "$user" ]; then
        echo "Failed to create user: $response" >&2
        return 1
    fi
    echo "$user"
}

configure_smtp_domain() {
    local user_input
    if [ "$SMTP2GO_DOMAIN_VALIDATED" = "true" ]; then
        echo "Domain has been previously verified." >&2
        if [ "$RESUME" = "true" ]; then return 0; fi
        read -p "Do you want to revalidate the domain configuration? [y/N]" user_input </dev/tty
        user_input=${user_input:-N}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    if [ -z "$CF_DOMAIN_NAME" ] || [ -z "$CF_DNS_API_TOKEN" ] || [ -z "$SMTP2GO_API_KEY" ]; then
        echo "Error: Please set CF_DOMAIN_NAME, CF_DNS_API_TOKEN and SMTP2GO_API_KEY values in the '$ENV_FILE' file." >&2
        return 1
    fi
    local response=$(smtp2go_rest_call POST domain/view)
    if [ $? -ne 0 ]; then
        return 1
    fi
    local domain=$(echo "$response" | jq -r --arg domain "$CF_DOMAIN_NAME" '.data.domains[] | select(.domain.fulldomain == $domain)')
    if [ -z "$domain" ]; then
        domain=$(smtp2go_add_domain)
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    local dkim=$(echo "$domain" | jq -r '.domain.dkim_verified')
    local return_path=$(echo "$domain" | jq -r '.domain.rpath_verified')
    local link=$(echo "$domain" | jq -r '.trackers[0].cname_verified')
    if [ "$dkim" = "true" ] && [ "$return_path" = "true" ]; then
        echo "Domain $CF_DOMAIN_NAME is fully verified" >&2
    else
        echo "Domain $CF_DOMAIN_NAME is not fully verified" >&2
        cloudflare_configure "$domain"
        if [ $? -ne 0 ]; then
            return 1
        fi
        smtp2go_validate_domain
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    save_env SMTP2GO_DOMAIN_VALIDATED "true"
}

configure_smtp_user() {
    if [ -n "$SMTP_PASSWORD" ]; then
        echo "SMTP2GO user appears to already be configured." >&2
        if [ "$RESUME" = "true" ]; then return 0; fi
        read -p "Do you want to validate or re-create the user with SMTP2GO? [y/N] " user_input </dev/tty
        user_input=${user_input:-N}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    if [ -z "$SMTP_USERNAME" ] || [ -z "$SMTP2GO_API_KEY" ]; then
        echo "Error: Please set SMTP_USERNAME and SMTP2GO_API_KEY values in the '$ENV_FILE' file." >&2
        return 1
    fi
    local username="$SMTP_USERNAME"
    local response=$(smtp2go_rest_call POST users/smtp/view)
    if [ $? -ne 0 ]; then
        return 1
    fi
    local user=$(echo "$response" | jq -r --arg username "$username" '.data.results[] | select(.username == $username)')
    if [ -z "$user" ]; then
        echo "User '$username' does not exist in SMTP2GO account" >&2
        user=$(smtp2go_add_user $username)
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    local password=$(echo "$user" | jq -r '.email_password')
    save_env SMTP_PASSWORD "${password}"
}

check_cloudflared() {
    if ! command -v cloudflared &>/dev/null; then
        echo "cloudflared is not installed." >&2
        read -p "Do you want to install cloudflared? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            echo "Installing cloudflared..." >&2
            sudo mkdir -p --mode=0755 /usr/share/keyrings
            curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
            echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
            sudo apt-get update && sudo apt-get install cloudflared
        else
            abort_install
            return 1
        fi
    fi
    if [ ! -f ~/.cloudflared/cert.pem ]; then
        echo "Cloudflared is not authenticated." >&2
        read -s -N 1 -p "Press a key to proceed with authentication..." </dev/tty
        echo
        cloudflared tunnel login
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
}

cloudflared_logout() {
    if [ -f ~/.cloudflared/cert.pem ]; then
        echo
        read -p "Do you want to logout from cloudflared (recommended)? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            rm ~/.cloudflared/cert.pem
        fi
    fi
}

configure_cloudflare_tunnel() {
    if [ -z "$CF_TUNNEL_NAME" ]; then
        echo "Error: Please set c values in the '$ENV_FILE' file." >&2
        return 1
    fi
    local user_input
    local token_file=${SECRETS_PATH}cloudflare_tunnel_token
    if [ -n "$CF_TUNNEL_ID" ] && [ -f "$token_file" ]; then
        echo "Cloudflare tunnel appears to be already configured." >&2
        if [ "$RESUME" = "true" ]; then return 0; fi
        read -p "Do you want to reconfigure the Cloudflare tunnel information? [y/N] " user_input </dev/tty
        user_input=${user_input:-N}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    check_cloudflared
    if [ $? -ne 0 ]; then
        return 1
    fi
    local tunnel_id=$(cloudflared tunnel list --output json | jq -r --arg name "$CF_TUNNEL_NAME" '.[] | select(.name == $name) | .id')
    if [ $? -ne 0 ]; then
        return 1
    fi
    local tunnel_token
    if [ -z "$tunnel_id" ]; then
        echo "Tunnel '$CF_TUNNEL_NAME' doesn't exist. Creating new tunnel..." >&2
        local tunnel=$(cloudflared tunnel create --output json "$CF_TUNNEL_NAME" | jq .)
        if [ $? -ne 0 ]; then
            return 1
        fi
        tunnel_id=$(echo "$tunnel" | jq -r '.id')
    fi
    echo "Saving tunnel id '$CF_TUNNEL_NAME' in '$ENV_FILE'" >&2
    save_env CF_TUNNEL_ID "$tunnel_id"
    echo "Saving tunnel credentials to '$token_file'..." >&2
    cloudflared tunnel token --cred-file "$token_file" "$CF_TUNNEL_NAME"
    if [ $? -ne 0 ]; then
        return 1
    fi
    cloudflared_logout
}

check_tailscale() {
    if ! command -v tailscale >/dev/null 2>&1; then
        echo "tailscale is not installed."
        read -p "Do you want to install tailscale? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            echo "Installing tailscale..." >&2
            curl -fsSL https://tailscale.com/install.sh | sh
            sudo systemctl enable --now tailscaled
        else
            abort_install
            return 1
        fi
    fi
}

connect_tailscale() {
    local connected=false
    echo "Connecting to Tailscale..."
    sudo tailscale up
    for i in {1..15}; do
        if tailscale status >/dev/null 2>&1; then
            connected=true
            break
        fi
        sleep 1
    done
    if [ ! "$connected" = true ]; then
        echo "Failed to connect Tailscale."
        return 1
    fi
}

configure_tailscale() {
    check_tailscale
    if [ $? -ne 0 ]; then
        return 1
    fi
    connect_tailscale
    if [ $? -ne 0 ]; then
        return 1
    fi
    local tailscale_ip=$(tailscale ip -4)
    if [ -z "$tailscale_ip" ]; then
        echo "Failed to retrieve Tailscale IP"
        return 1
    fi
    echo "Tailscale is connected."
    save_env TAILSCALE_IP "$tailscale_ip"
    # local zone_id=$(cloudflare_get_zone_id)
    # if [ $? -ne 0 ]; then
    #     return 1
    # fi
    # echo "Creating catch-all record with Tailscale IP: $tailscale_ip" >&2
    # cloudflare_add_or_update_record $zone_id "A" "*" "$tailscale_ip"
    # if [ $? -ne 0 ]; then
    #     return 1
    # fi
}

check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "Docker is not installed."
        read -p "Do you want to install Docker? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            echo "Installing Docker..." >&2
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh ./get-docker.sh
            sudo systemctl enable --now docker
            sudo groupadd docker
            sudo usermod -aG docker $USER
            newgrp docker
        else
            abort_install
            return 1
        fi
    fi
}

configure_docker() {
    check_docker
    if [ $? -ne 0 ]; then
        return 1
    fi
    ask_for_env DOCKER_NETWORK "Docker network"
    if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
        echo "Docker network '$DOCKER_NETWORK' does not exist. Creating it with default settings..."
        docker network create "$DOCKER_NETWORK"
    else
        echo "Docker network '$DOCKER_NETWORK' already exists."
    fi
}

prepare_env_file() {
    local remote_env="$GH_RAW_BASE_URL/.env"
    local user_input merge_with
    if [ -f "$ENV_FILE" ]; then
        echo "File '$ENV_FILE' already exists."
        local missing_keys=false
        while IFS='=' read -r key value; do
            if [ -n "$key" ]; then
                if ! grep -q "^${key}=" "$ENV_FILE"; then
                    echo "Key '$key' not found in '$ENV_FILE'"
                    missing_keys=true
                fi
            fi
        done < <(wget -qO- "$remote_env" | grep -v '^[[:space:]]*#')
        if [ "$missing_keys" != true ]; then return 0; fi
        local key value 
        read -p "Do you want to merge '$ENV_FILE' with the version that is available online? [Y/n] " user_input </dev/tty
        user_input=${user_input:-Y}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then 
            abort_install
            return 1;
        fi
        merge_with="$ENV_FILE.bak"
        mv "$ENV_FILE" "$merge_with"
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    wget -qO "$ENV_FILE" "$remote_env"
    if [ $? -ne 0 ]; then
        return 1
    fi
    if [ -n "$merge_with" ]; then
        grep -v '^[[:space:]]*#' "$merge_with" | while IFS='=' read -r key value; do
            if [ -n "$key" ] && [ -n "$value" ]; then
                if grep -q "^${key}=" "$ENV_FILE"; then
                    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
                    echo "Updated '$key' in '$ENV_FILE'."
                fi
            fi
        done
    fi
}

prepare_docker_compose() {
    local user_input
    local compose_file="docker-compose.yml"
    if [ -f "$compose_file" ]; then
        echo "File '$compose_file' already exists."
        if [ "$RESUME" = "true" ]; then return 0; fi
        read -p "Do you want to replace '$compose_file' with the version that is available online? [y/N] " user_input </dev/tty
        user_input=${user_input:-N}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then return 0; fi
    fi
    wget -qO "$compose_file" "$GH_RAW_BASE_URL/docker-compose.yml"
    if [ $? -ne 0 ]; then
        return 1
    fi
    echo "File '$compose_file' created."
}

deploy_project() {
    local user_input
    read -p "Project '$COMPOSE_PROJECT' is ready for deployment. Do you want to proceed? [Y/n] " user_input </dev/tty
    user_input=${user_input:-Y}
    if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
        abort_install
        return 1
    fi
    if [ "$COMPOSE_UPDATE" != true ] && docker compose ls | awk 'NR > 1 {print $1}' | grep -qx "$COMPOSE_PROJECT"; then
        echo "Compose project '$PROJECT' already exists."
        echo "Run again with the --update flag if you want to update the existing project."
        return 1
    fi
    docker compose -p "$COMPOSE_PROJECT" --env-file "$ENV_FILE" up -d -y --remove-orphans $COMPOSE_OPTIONS
    if [ $? -ne 0 ]; then
        return 1
    fi
}

bootstrap_lldap() {
    # Paste the generated secret for Authelia's LLDAP password into the bootstrap user file
    local authelia_password=$(<"${SECRETS_PATH}ldap_authelia_password")
    local authelia_file="${APPDATA_LOCATION%/}/lldap/bootstrap/user-configs/authelia.json"
    local authelia_json=$(jq --arg password "$authelia_password" '.password = $password' "$authelia_file")
    echo "$authelia_json" > "$authelia_file"
    # Run LLDAP's built-in bootstrap script to create/update users and groups
    echo "Bootstrapping LLDAP with pre-configured users and groups..."
    docker exec \
        -e LLDAP_ADMIN_PASSWORD_FILE=/run/secrets/ldap_admin_password \
        -e USER_CONFIGS_DIR=/data/bootstrap/user-configs \
        -e GROUP_CONFIGS_DIR=/data/bootstrap/group-configs \
        -it lldap ./bootstrap.sh
    if [ $? -ne 0 ]; then
        return 1
    fi
    # Restart Authelia so it can connect to LLDAP with the updated user information
    echo "Restarting Authelia container..."
    docker restart authelia
    if [ $? -ne 0 ]; then
        return 1
    fi
}

abort_install() {
    echo -ne "\n\nSetup aborted by user. To resume, run: bash $0 --resume"
    if [ -n "$APPDATA_OVERRIDE" ]; then echo -n " --appdata \"$APPDATA_OVERRIDE\""; fi
    if [ "$ENV_FILE" != ".env" ]; then echo -n " --env \"$ENV_FILE\""; fi
    if [ "$USE_SMTP2GO" = "false" ]; then echo -n " --custom-smtp"; fi
    echo -e "\n"
    exit 1
}

print_usage() {
    echo "Usage: $0 [--appdata <path>] [--env <file>]"
    echo ""
    echo "Options:"
    echo "  --appdata <path>    Application data for deployment. [Default: '/srv/appdata']"
    echo "  --env <path>        Environment file to read variables from. [Default: './env']"
    echo "  --project <name>    Name to use for the Docker Compose project. [Default: 'self-host']"
    echo "  --custom-smtp       Do not use SMTP2GO for sending email, provide custom SMTP configuration."
    echo "  --resume            Skip any steps that have been previously completed."
    echo "  --update            Update a previously deployed Docker Compose project."
    echo "  --dry-run           Execute Docker Compose in dry run mode."
    echo "  -h, --help          Display this help message."
    exit 1
}

APPDATA_OVERRIDE=
SECRETS_PATH=
USE_SMTP2GO=true
RESUME=false
ENV_FILE=.env
COMPOSE_PROJECT=self-host
COMPOSE_UPDATE=false
COMPOSE_OPTIONS=

while [ "$#" -gt 0 ]; do
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    --appdata)
        if [ -n "$2" ]; then
            APPDATA_OVERRIDE="$2"
            shift 2
            continue
        else
            echo "Error: --appdata requires a directory path."
            exit 1
        fi
        ;;
    --custom-smtp)
        USE_SMTP2GO=false
        shift 1
        continue
        ;;
    --update)
        COMPOSE_UPDATE=true
        shift 1
        continue
        ;;
    --dry-run)
        COMPOSE_OPTIONS="$COMPOSE_OPTIONS --dry-run"
        shift 1
        continue
        ;;
    --resume)
        RESUME=true
        shift 1
        continue
        ;;
    --env)
        if [ -n "$2" ]; then
            ENV_FILE="$2"
            shift 2
            continue
        else
            echo "Error: --env requires a file path."
            exit 1
        fi
        ;;
    --project)
        if [ -n "$2" ]; then
            COMPOSE_PROJECT="$2"
            shift 2
            continue
        else
            echo "Error: --project requires a name."
            exit 1
        fi
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

trap "abort_install" SIGINT

prepare_env_file
if [ $? -ne 0 ]; then
    echo "Failed to prepare '$ENV_FILE'."
    exit 1
fi

source "$ENV_FILE"

prepare_docker_compose
if [ $? -ne 0 ]; then
    echo "Failed to prepare 'docker-compose.yml'."
    exit 1
fi

ask_for_variables
if [ $? -ne 0 ]; then
    echo "Failed to configure '$ENV_FILE' with configuration values."
    exit 1
fi

create_appdata_location
if [ $? -ne 0 ]; then
    echo "Could not create data folders."
    exit 1
fi

download_appdata
if [ $? -ne 0 ]; then
    echo "Could not download application data."
    exit 1
fi

configure_docker
if [ $? -ne 0 ]; then
    echo "Docker configuration failed."
    exit 1
fi

configure_tailscale
if [ $? -ne 0 ]; then
    echo "Tailscale configuration failed."
    exit 1
fi

configure_cloudflare_tunnel
if [ $? -ne 0 ]; then
    echo "Cloudflare tunnel configuration failed."
    exit 1
fi

if [ "$USE_SMTP2GO" = "true" ]; then

    configure_smtp_domain
    if [ $? -ne 0 ]; then
        echo "SMTP domain configuration failed."
        exit 1
    fi

    configure_smtp_user
    if [ $? -ne 0 ]; then
        echo "SMTP user configuration failed."
        exit 1
    fi

    save_env SMTP_SERVER mail.smtp2go.com
    save_env SMTP_PORT "587"
fi

save_secrets
if [ $? -ne 0 ]; then
    echo "Failed to save secret files."
    exit 1
fi

deploy_project
if [ $? -ne 0 ]; then
    echo "Failed to deploy project with docker compose."
    exit 1
fi

bootstrap_lldap
if [ $? -ne 0 ]; then
    echo "Failed to bootstrap LLDAP."
    exit 1
fi
