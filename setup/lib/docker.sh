if [ -n "$__LIB_COMPOSE" ]; then return 0; fi

__LIB_COMPOSE=1

#shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

###
# Runs the YQ utility using a docker container rather than requiring installing it
#
# @option    -w [workdir]   Working directory where files can be loaded in the container (default=${PWD})
# @param    (*)             Any additional parameters are passed down to yq
# @return   {string}        Any output from yq
###
yq() {
    local cmd result workdir=$1
    cmd="docker run -q --rm -it -v '$workdir':/workdir mikefarah/yq:4.45.1 -M"
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
# Reads the image version of service containers within a compose project and updates the
# specified docker-compose file to match
#
# @param $1 {string} The path to the compose file
# @param $2 {string} The name of the compose project (to load existing containers from)
# @return   {void}
###
compose_match_container_versions() {
    local compose_path compose_file compose_full_path=$1 compose_project=$2
    compose_path=$( dirname "$compose_full_path" )
    compose_file=$( basename "$compose_full_path" )

    local temp_file temp_path temp_full_path
    temp_full_path=$(mktemp)
    temp_path=$( dirname "$temp_full_path" )
    temp_file=$( basename "$temp_full_path" )
    cp -f "$compose_full_path" "$temp_full_path"

    echo -n "Matching container versions "

    local compose_services deployed_services
    if ! compose_services=$(yq "$compose_path" e '.services | keys | .[]' "$compose_file"); then
        log_error "Failed extracting services from compose file '$compose_full_path'"
        return 1
    fi

    local compose_output
    if ! compose_output=$(docker compose -p "$compose_project" ps --format json); then
        log_error "Failed to enumerate deployed services"
        return 1
    fi

    if [[ $(echo "$compose_output" | grep -c '^{') -gt 0 ]]; then
        # Line-by-line JSON objects format
        if ! deployed_services=$(echo "$compose_output" | jq -s -r '.[] | (.Service // .service)'); then
            log_error "Failed to enumerate deployed services"
            return 1
        fi
    else
        # JSON array format
        if ! deployed_services=$(echo "$compose_output" | jq -r '.[] | (.Service // .service)'); then
            log_error "Failed to enumerate deployed services"
            return 1
        fi
    fi

    local service
    for service in $compose_services; do
        echo -n ". "

        if yq "$compose_path" e ".services.$service.image" "$compose_file" | grep -q "null"; then
            continue
        fi

        if ! echo "$deployed_services" | grep -q "^$service$"; then
            continue
        fi

        local container_id
        container_id=$(docker compose -p "$compose_project" ps -q "$service")
        
        if [[ -z $container_id ]]; then
            continue
        fi

        local current_image
        current_image=$(docker inspect --format='{{.Config.Image}}' "$container_id")

        if [[ -z $current_image ]]; then
            echo -e "\n${Yellow}Could not find image for service: ${Purple}$service{$COff}"
            continue
        fi

        # Get the current image value from the compose file
        local old_image
        old_image=$(yq "$compose_path" e ".services.$service.image" "$compose_file")

        if [ "${current_image}" != "${old_image}" ]; then
            # Update the image in the temporary file
            echo -e "\n\n${Yellow}Updating service definition for '$service' with image: '$current_image'${COff}"
            yq "$temp_path" -i ".services.$service.image = \"$current_image\"" "$temp_file" > /dev/null
        fi
        
    done

    echo

    if ! cp -f "$compose_full_path" "${compose_full_path}.bak"; then
        log_error "Failed to create backup compose file '${compose_full_path}.bak'"
        return 1
    fi
    if ! mv "$temp_full_path" "$compose_full_path"; then
        log_error "Failed to replace compose file '$compose_full_path'"
        return 1
    fi
}