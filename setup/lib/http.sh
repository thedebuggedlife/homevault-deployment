if [ -n "$__LIB_HTTP" ]; then return 0; fi

__LIB_HTTP=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

GH_IO_BASE_URL=https://thedebuggedlife.github.io/selfhost-bootstrap

################################################################################
#                                   HTTP HELPERS

# Makes an HTTP request and returns the response body (if any)
# Params:   $1 HTTP Method (GET|DELETE|PUT|POST)
#           $2 URL of request
#           $3 Header for authentication (e.g. "X-API-Key: my-key")
#           $4 Body of the request [optional]
# Returns:  The body of the response
rest_call() {
    local method=$1
    local url=$2
    local auth=$3
    local body=$4
    # Debug
    # echo "Method: $method" >&2
    # echo "URL: $url" >&2
    # echo "Body: $body" >&2
    # Make the curl request.
    local response http_status
    if [ -n "$body" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            --request "$method" \
            --url "$url" \
            --header "Content-Type: application/json" \
            --header "$auth" \
            --header "accept: application/json" \
            --data "$body")
    else
        response=$(curl -s -w "\n%{http_code}" \
            --request "$method" \
            --url "$url" \
            --header "$auth" \
            --header "accept: application/json")
    fi
    # Separate the body and the HTTP status code.
    http_status=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    # Debug
    # echo "HTTP Status: $http_status" >&2
    # echo -e "Response Body:\n$(echo $response | jq .)" >&2
    # Check if the status code indicates success (2XX)
    if [[ "$http_status" =~ ^2 ]]; then
        echo "$response"
    else
        log_error "Request to '$method' '$url' failed with $http_status: $response"
        return 1
    fi
}

###
# Downloads the application data for a given module
#
# @param $1 Name of the module
# @return void
###
download_module_appdata() {
    local module_name=$1
    local appdata_url="$GH_IO_BASE_URL/appdata/$module_name.zip"

    echo -e "Downloading appdata from ${Cyan}$appdata_url${COff} ...\n"
    curl -fsSL "$appdata_url" \
        | sudo busybox unzip -n - -d "$APPDATA_LOCATION" 2>&1 \
        | { grep -E "creating:|inflating:" || echo ""; } \
        | awk -F': ' '{print $2}' \
        | while read -r path; do
            full_path="${APPDATA_LOCATION%/}/$path"
            echo -e "Changing owner of: ${Purple}${full_path}${COff}"
            sudo chown "$AS_USER":docker "$full_path"
            if [[ "$path" == *.sh ]]; then
                echo -e "Setting execute flag on: ${Purple}${full_path}${COff}"
                sudo chmod +x "$full_path"
            fi
        done || \
    {
        log_error "Failed to download application data for '$module_name'"
        exit 1
    }
}

