#!/usr/local/bin/bash

if [ -z "$HOST_PORT" ]; then
    echo "Missing variable: HOST_PORT" >&2
    exit 1
fi

if [ -z "$ROUTER_PORT" ]; then
    echo "Missing variable: ROUTER_PORT" >&2
    exit 1
fi

if ! apk info -e "miniupnpc" >/dev/null 2>&1; then
    echo "Installing miniupnpc..."
    if ! apk add "miniupnpc"; then
        echo "Failed to install miniupnpc" >&2
        exit 1
    fi
fi

upnpc_args=(-e "Nextcloud Talk TURN Server" -r "${HOST_PORT}" "${ROUTER_PORT}" tcp "${HOST_PORT}" "${ROUTER_PORT}" udp)

while true; do
    # upnpc can be flaky - try 3 times before giving up
    upnpc "${upnpc_args[@]}" || {
        echo "Call to upnpc failed. Trying again..." >&2
        upnpc "${upnpc_args[@]}" || {
            echo "Call to upnpc failed. Trying again..." >&2
            upnpc "${upnpc_args[@]}" || {
                echo "Call to upnpc failed. Giving up." >&2
            }
        }
    }
    echo "Sleeping until $(date -d "+${UPNP_SLEEP:-3600} seconds")"
    sleep "${UPNP_SLEEP:-3600}"
done