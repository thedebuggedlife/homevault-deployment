if [ -n "$__LIB_DOCKER" ]; then return 0; fi

__LIB_DOCKER=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

_DOCKER_INSTALLED=$(if ! command -v docker >/dev/null 2>&1; then echo "false"; else echo "true"; fi)

YQ_VERSION=4.45.1

###
# Runs the YQ utility using a docker container rather than requiring installing it
#
# @param    $1          Working directory where files can be loaded in the container (default=${PWD})
# @param    (*)         Any additional parameters are passed down to yq
# @return   {string}    Any output from yq
###
yq() {
    local cmd result workdir=$1
    shift
    cmd="docker run -q --rm -v '$workdir':/workdir mikefarah/yq:$YQ_VERSION -M"
    for arg in "$@"; do
        cmd+=$(printf " '%s'" "$arg")
    done
    result=$(sg docker -c "$cmd" | tr -d '\r')
    local exit_code=$?
    echo "$result"
    return $exit_code
}

###
# Runs the specified docker command using the `docker` group identity
#
# @param    (*)             Any additional parameters are passed down to docker
# @return   {string}        Any output from docker
###
docker() {
    local cmd result
    cmd="docker"
    for arg in "$@"; do
        cmd+=$(printf " '%s'" "$arg")
    done
    result=$(sg docker -c "$cmd" | tr -d '\r')
    local exit_code=$?
    echo "$result"
    return $exit_code
}

###
# Check that Docker is installed
#
# @return void
###
configure_docker() {
    if [ "$_DOCKER_INSTALLED" != "true" ]; then
        log_header "Configuring Docker"
        log "\n${Yellow}Docker is not installed.${COff}"

        if ask_confirmation -y -p "Do you want to install Docker?"; then
            log "Installing Docker..."
            if ! curl -fsSL https://get.docker.com | sudo sh; then
                log_error "Docker installation failed"
                exit 1
            else
                log "\n✅ Docker installation completed successfully\n"
            fi
            sudo systemctl enable --now docker > /dev/null
            if ! getent group docker > /dev/null 2>&1; then
                sudo groupadd docker > /dev/null
            fi
            sudo usermod -aG docker $AS_USER > /dev/null
            _DOCKER_INSTALLED=true
        else
            abort_install
            exit 1
        fi
    fi
}

configure_docker_group() {
    log_header "Configuring docker group"
    local user="${AS_USER:-$(whoami)}"

    # Create docker group if it doesn't exist
    if ! getent group docker &>/dev/null; then
        log "Creating docker group..."
        if ! sudo groupadd docker; then
            log_error "Failed to create docker group"
            return 1
        fi
    fi
    
    # Check if user is already in docker group
    if groups "$user" | grep -q '\bdocker\b'; then
        log "User '$user' is already in the docker group"
        return 0
    fi
    
    # Add user to docker group
    echo "Adding user '$user' to docker group..."
    if sudo usermod -aG docker "$user"; then
        log "Successfully added '$user' to docker group"
        return 0
    else
        log_error "Failed to add user '$user' to docker group"
        return 1
    fi
}

##
# Function to get the tag of a Docker image by repository name
# Usage: docker_get_image_tag "ghcr.io/immich-app/immich-server"
#
# @param    $1  {string}    Name of the repository to look up
# @return       {string}    The tag of the image or empty
###
docker_get_image_tag() {
    local repository="$1"
    local tag
    
    # Get the tag using jq to filter by repository
    tag=$(docker compose -p homevault images --format json | \
          jq -r --arg repo "$repository" \
          '.[] | select(.Repository == $repo) | .Tag // empty') || {
            log_error "Failed to retrieve image tag for '$repository'"
            return 1
          }
    
    echo "$tag"
}

###
# Function to compare two semver strings
# Usage: is_version_newer "v1.132.3" "v1.133.0"
#
# @param    $1  {string}    The first semver to compare
# @param    $2  {string}    The second semver to compare
# @status   0 if second version is newer, 1 otherwise
###
docker_is_version_newer() {
    local version1="$1"
    local version2="$2"
    
    # Strip the 'v' prefix if present
    version1="${version1#v}"
    version2="${version2#v}"
    
    # Split versions into components
    IFS='.' read -r -a v1_parts <<< "$version1"
    IFS='.' read -r -a v2_parts <<< "$version2"
    
    # Compare major, minor, and patch versions
    for i in {0..2}; do
        # Default to 0 if part doesn't exist
        local part1="${v1_parts[i]:-0}"
        local part2="${v2_parts[i]:-0}"
        
        # Convert to integers for comparison
        part1=$((10#$part1))
        part2=$((10#$part2))
        
        if (( part2 > part1 )); then
            return 0  # version2 is newer
        elif (( part2 < part1 )); then
            return 1  # version1 is newer
        fi
        # If equal, continue to next part
    done
    
    # Versions are equal
    return 1
}

###
# Reads the image version of service containers within a compose project and updates the
# specified docker-compose file to match
#
# @param $1 {string} The name of the compose project (to load existing containers from)
# @param $* {string} The path to the compose files to update
# @return   {void}
###
compose_match_container_versions() {
    local compose_project=$1
    shift

    local -A installed_services
    local service version
    while read -r service version; do
        installed_services["$service"]="$version"
    done < <(docker compose -p "$compose_project" ps --format json | jq -s -r '.[] | "\(.Service) \(.Image)"')

    log "Matching container image tags ..."

    local project_file
    for project_file in "$@"; do
        local temp_file temp_file_name temp_file_path
        temp_file=$(mktemp)
        temp_file_name=$(basename "$temp_file")
        temp_file_path=$(dirname "$temp_file")
        cp -f "$project_file" "$temp_file"

        local any_replaced=false
        # shellcheck disable=SC2016
        while read -r service version; do
            local installed_version=${installed_services["$service"]}
            if [[ -n "$installed_version" && "$version" != "null" && "$version" != "$installed_version" ]]; then
                log "Updating service definition for ${Cyan}$service${COff} with image: ${Purple}$installed_version${COff}"
                yq "$temp_file_path" -i ".services.$service.image = \"$installed_version\"" "$temp_file_name" > /dev/null
                any_replaced=true
            fi
        done < <(yq "$temp_file_path" '(.services | keys | .[] | .) as $service | "\($service) \(.services[$service].image)"' "$temp_file_name")

        if [ "$any_replaced" = true ]; then
            cp -f "$project_file" "$project_file".bak
            mv "$temp_file" "$project_file"
        fi
    done
}

###
# Checks if a service exists in a compose project
#
# @param    $1  {string}    Service name
# @param    $@              Additional parameters passed to docker
#
# @status   0 if service exists
# @status   1 if service does not exist
##
compose_service_exists() {
  local service_name="$1" services
  
  services=$(docker compose -p "$COMPOSE_PROJECT_NAME" ps --services "$@" 2>/dev/null) || {
    return 1
  }
  
  if echo "$services" | grep -q "^$service_name$"; then
    return 0
  else
    return 1
  fi
}