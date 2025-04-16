if [ -n "$__LIB_HTTP" ]; then return 0; fi

__LIB_HTTP=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

GH_IO_BASE_URL=https://thedebuggedlife.github.io/selfhost-bootstrap

################################################################################
#                                   HTTP HELPERS

###
# Makes an HTTP request and returns the response body (if any)
# Params:
#   $1 {string} HTTP Method (GET|DELETE|PUT|POST)
#   $2 {string} URL of request
# Options:
#   -b [body]       Body of the request [optional]
#   -h [header]     Additional header (e.g. "X-API-Key: my-key") [optional]
#   -c [container]  Docker container to run request within [optional]
#   -e [code]       Expected status code. Accepts regex. [default="^2"]
#   -s              Return only the status code.
# Returns:  
#   {string} The body of the response
###
rest_call() {
    local method=$1 url=$2 expected="^2" container status_only
    local -a args=(
        -s -w "\n%{http_code}"
        --request "$method"
        --url "$url"
        --header "Content-Type: application/json"
        --header "Accept: application/json")
    shift 2
    while getopts ":h:b:c:e:s" opt; do
        case $opt in
            h) args+=("--header" "$OPTARG") ;;
            b) args+=("--data" "$OPTARG") ;;
            c) container="$OPTARG" ;;
            e) expected="$OPTARG" ;;
            s) status_only=true ;;
            \?) log_warn "rest_call: Invalid option: -$OPTARG" ;;
            :) if [ "$OPTARG" != "b" ]; then log_warn "rest_call: Option -$OPTARG requires an argument"; fi ;;
        esac
    done
    local response http_status
    if [ -z "$container" ]; then
        response=$(curl "${args[@]}")
    else
        docker_cmd="docker run -q --rm --network container:$container appropriate/curl"
        for arg in "${args[@]}"; do
            docker_cmd+=$(printf " %q" "$arg")
        done
        response=$(sg docker -c "$docker_cmd")
    fi
    # Separate the body and the HTTP status code.
    http_status=$(echo "$response" | tail -n1)
    # If only the HTTP status is required, return it
    if [ "$status_only" = true ]; then echo "$http_status"; return 0; fi
    response=$(echo "$response" | sed '$d')
    # Check if the status code matches expected
    if [[ "$http_status" =~ $expected ]]; then
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

