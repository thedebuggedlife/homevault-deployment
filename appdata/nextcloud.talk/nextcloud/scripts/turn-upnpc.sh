#!/usr/local/bin/bash

exec 3>&2

exec 2> >(while read -r line; do echo "$(date +"%Y-%m-%d %H:%M:%S") ERROR $line" >&3; done)

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") ${2:-INFO} $1"
}

if [ "$UPNP_SLEEP" = "0" ]; then
    log "UPnP port mapping is disabled via environment variable"
    sleep infinite
fi

if [ -z "$HOST_PORT" ]; then
    log "Missing variable: HOST_PORT" ERROR
    exit 1
fi

if [ -z "$ROUTER_PORT" ]; then
    log "Missing variable: ROUTER_PORT" ERROR
    exit 1
fi

if ! apk info -e "miniupnpc" >/dev/null 2>&1; then
    log "Installing miniupnpc..."
    if ! apk add "miniupnpc"; then
        log "Failed to install miniupnpc" ERROR
        exit 1
    fi
fi

call_upnpc() {
    # upnpc can be flaky - try 3 times before giving up
    upnpc "$@" >/dev/null || {
        log "Call to upnpc failed. Trying again..." WARN
        upnpc "$@" >/dev/null || {
            log "Call to upnpc failed. Trying again..." WARN
            upnpc "$@" >/dev/null || {
                log "Call to upnpc failed. Giving up." ERROR
                return 1
            }
        }
    }
}

get_current_ip() {
    ip -o -4 route get 1 | awk '{print $7}'
}

add_my_mappings() {
    log "Adding port mappings for ${ROUTER_PORT}:TCP/UDP to this host"
    call_upnpc -e "Nextcloud Talk TURN Server" -r "${HOST_PORT}" "${ROUTER_PORT}" TCP "${HOST_PORT}" "${ROUTER_PORT}" UDP || return 1
}

clear_mapping() {
    local remote_host=$1
    local protocol=$2
    log "Removing port mappings for ${ROUTER_PORT}:$protocol to host $remote_host"
    call_upnpc -d "${ROUTER_PORT}" "$protocol" "$remote_host"
}

clear_other_mappings() {
    local line remote_host my_host protocol
    my_host=$(get_current_ip)
    upnpc -l | grep "${ROUTER_PORT}->" | while read -r line; do
        if [[ $line =~ ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
            remote_host="${BASH_REMATCH[1]}"
            if [ "$remote_host" != "$my_host" ]; then
                if [[ $line =~ (TCP|UDP)\b[[:space:]] ]]; then
                    protocol="${BASH_REMATCH[1]}"
                    clear_mapping "$remote_host" "$protocol"
                fi
            fi
        fi
    done
}

while true; do
    log "Starting new run ..."
    clear_other_mappings
    add_my_mappings
    log "Sleeping for ${UPNP_SLEEP:-3600} seconds ..."
    sleep "${UPNP_SLEEP:-3600}"
done