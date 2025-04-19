if [ -n "$__LIB_DOCKER" ]; then return 0; fi

__LIB_DOCKER=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

_DOCKER_INSTALLED=$(if ! command -v docker >/dev/null 2>&1; then echo "false"; else echo "true"; fi)

###
# Runs the YQ utility using a docker container rather than requiring installing it
#
# @option    -w [workdir]   Working directory where files can be loaded in the container (default=${PWD})
# @param    (*)             Any additional parameters are passed down to yq
# @return   {string}        Any output from yq
###
yq() {
    local cmd result workdir=$1
    cmd="docker run -q --rm -v '$workdir':/workdir mikefarah/yq:4.45.1 -M"
    shift
    for arg in "$@"; do
        cmd+=$(printf " %q" "$arg")
    done
    if ! result=$(sg docker -c "$cmd" | tr -d '\r'); then return 1; fi
    echo "$result"
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
        cmd+=$(printf " %q" "$arg")
    done
    if ! result=$(sg docker -c "$cmd"); then return 1; fi
    echo "$result"
}

###
# Check that Docker is installed
#
# @return void
###
configure_docker() {
    if [ "$_DOCKER_INSTALLED" != "true" ]; then
        echo -e "\n${Yellow}Docker is not installed.${COff}"
        local user_input=Y
        if [ "$UNATTENDED" != "true" ]; then
            read -p "Do you want to install Docker? [Y/n] " user_input </dev/tty
            user_input=${user_input:-Y}
        fi
        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            echo "Installing Docker..."
            if ! curl -fsSL https://get.docker.com | sudo sh; then
                log_error "Docker installation failed"
                exit 1
            else
                echo -e "\n✅ Docker installation completed successfully\n"
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

    echo "Matching container image tags ..."

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
            if [[ "$version" != "null" && "$version" != "$installed_version" ]]; then
                echo -e "Updating service definition for ${Cyan}$service${COff} with image: ${Purple}$installed_version${COff}"
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