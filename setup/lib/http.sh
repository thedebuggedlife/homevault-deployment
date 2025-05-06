if [ -n "$__LIB_HTTP" ]; then return 0; fi

__LIB_HTTP=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

GH_IO_BASE_URL=https://thedebuggedlife.github.io/selfhost-bootstrap
PUBLIC_IP=

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
    OPTIND=3
    while getopts ":h:b:c:e:s" opt; do
        case $opt in
            h) args+=("--header" "$OPTARG") ;;
            b) args+=("--data" "$OPTARG") ;;
            c) container="$OPTARG" ;;
            e) expected="$OPTARG" ;;
            s) status_only=true ;;
            \?) log_warn "rest_call: Invalid option: -$OPTARG" ;;
            :) log_warn "rest_call: Option -$OPTARG requires an argument" ;;
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

###
# Function to retrieve the public IP of the server. 
# The value is cached globally so it only needs to be retrieved once per script run
#
# @return {string} The public IP address of this host
###
get_public_ip() {
    if [ -n "$PUBLIC_IP" ]; then
        echo "$PUBLIC_IP"
    fi
    # Try multiple services in case one is down
    PUBLIC_IP=$(curl -s https://api.ipify.org || \
                curl -s https://icanhazip.com || \
                curl -s https://ipecho.net/plain || \
                curl -s https://ifconfig.me)
    
    if [ -z "$PUBLIC_IP" ]; then
        log_warn "Error: Could not determine public IP address"
        return 1
    fi

    echo "$PUBLIC_IP"
}


###
# Function to start a temporary HTTP server and return an arbitrary string
#
# @param    $1  Port to listen at
# @param    $2  Test string to return from server
#
# @return   {string:list}
#   [0] PID of the server
#   [1] Temporary directory created for the server
###
start_temp_server() {
    local port=$1
    local test_string=$2

    # Make sure Python3 is installed
    check_python3 >&2 || return 1
    
    # Create a temporary directory
    temp_dir=$(mktemp -d)
    
    # Create an index.html file with the test string
    echo "$test_string" > "$temp_dir/index.html"
    
    # Start the HTTP server from the temporary directory
    (cd "$temp_dir" && python3 -m http.server "$port" --bind 0.0.0.0) &> /dev/null &
    server_pid=$!
    
    # Give the server time to start
    sleep 2
    
    echo "$server_pid:$temp_dir"
}

###
# Function to check if a given port is routed to this host and accessible
#
# @param    $1  Port to check for traffic
# @param    $2  Timeout for the operation in seconds (default: 60)
###
check_port_routing() {
    local port=$1
    local timeout=${2:-60}

    # shellcheck disable=SC2155
    local start_time=$(date +%s)
    # shellcheck disable=SC2155
    local end_time=$((start_time + timeout))
    # shellcheck disable=SC2155
    local test_string="PORT_CHECK_$(date +%s)"

    if (echo >"/dev/tcp/localhost/$port") 2>/dev/null; then
        echo -e "\n${BIYellow}WARNING${COff}: Cannot check if port ${Cyan}$port${COff} is forwarded because it is already in use" >&2
        return 1
    fi

    echo -e "Checking if port ${Cyan}$port${COff} on this host is accessible from the internet" >&2

    local public_ip
    public_ip=$(get_public_ip) || return 1

    local server_info server_pid temp_dir
    server_info=$(start_temp_server "$port" "$test_string") || return 1
    IFS=':' read -r server_pid temp_dir <<< "$server_info"

    while true; do
        echo -n "." >&2
        response=$(curl -s --connect-timeout 5 "http://${public_ip}:${port}/")
        if echo "$response" | grep -q "$test_string"; then
            echo -e "\n${BIGreen}SUCCESS${COff}: Port ${Cyan}$port${COff} is properly routed to this machine" >&2
            kill "$server_pid" 2>/dev/null; rm -rf "$temp_dir" 2>/dev/null
            return 0
        else
            # shellcheck disable=SC2155
            local current_time=$(date +%s)
            if [ "$current_time" -ge $end_time ]; then
                echo -e "\n${BIYellow}WARNING${COff}: Port ${Cyan}$port${COff} is not accessible or not routed to this machine" >&2
                kill "$server_pid" 2>/dev/null; rm -rf "$temp_dir" 2>/dev/null
                return 1
            fi
            sleep 1
        fi
    done
}