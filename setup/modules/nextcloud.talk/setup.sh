if [ -n "$__SETUP_NEXTCLOUD_TALK" ]; then return 0; fi

__SETUP_NEXTCLOUD_TALK=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/docker.sh
source "$PROJECT_ROOT/lib/docker.sh"

## Check dependencies

if ! array_contains nextcloud "${ENABLED_MODULES[@]}"; then
    log_error "Module nextcloud.talk depends on nextcloud. You need to include it with '-m nextcloud'"
    return 1
fi

## Environment variables

NEXTCLOUD_TALK_SUBDOMAIN=
NEXTCLOUD_TALK_TURN_SECRET=
NEXTCLOUD_TALK_SIGNALING_SECRET=
NEXTCLOUD_TURN_SUBDOMAIN=
NEXTCLOUD_TURN_HOST_PORT=
NEXTCLOUD_TURN_ROUTER_PORT=

nextcloud_talk_map_router_port() {
    local router_port=$1
    local host_port=$2

    local upnpc_args=(-e "HomeVault" -r "${host_port}" "${router_port}" tcp "${host_port}" "${router_port}" udp)

    # upnpc can be flaky - try 3 times before giving up
    upnpc "${upnpc_args[@]}" >/dev/null || {
        echo "Call to upnpc failed. Trying again..." >&2
        upnpc "${upnpc_args[@]}" >/dev/null || {
            echo "Call to upnpc failed. Trying again..." >&2
            upnpc "${upnpc_args[@]}" >/dev/null || {
                echo "Call to upnpc failed. Giving up." >&2
                return 1
            }
        }
    }
}

nextcloud_talk_configure_turn() {
    # Stop the Talk container since it may be using the TURN port, and that would make it impossible to listen on that port
    docker stop nextcloud_talk > /dev/null 2>&1

    check_port_routing "${NEXTCLOUD_TURN_ROUTER_PORT}" 1 && return 0

    if [ "$UNATTENDED" != true ]; then
        read -p "Do you want to try to configure your router to map port ${NEXTCLOUD_TURN_ROUTER_PORT} to this host? [y/N] " user_input </dev/tty
        user_input=${user_input:-N}
        if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
            log_warn "Some functions of Nextcloud Talk may not work as expected. Try configuring your router manually later."
            return 0
        fi

        check_upnpc || {
            log_warn "Failed to forward port ${NEXTCLOUD_TURN_ROUTER_PORT} to this host. Try configuring your router manually later."
            return 0
        }

        nextcloud_talk_map_router_port "${NEXTCLOUD_TURN_ROUTER_PORT}" "${NEXTCLOUD_TURN_HOST_PORT}" || {
            log_warn "Some functions of Nextcloud Talk may not work as expected. Try configuring your router manually later."
            return 0
        }

        check_port_routing "${NEXTCLOUD_TURN_ROUTER_PORT}" 90 || {
            log_warn "Could not verify that port ${NEXTCLOUD_TURN_ROUTER_PORT} is mapped to this host. Some functions of Nextcloud Talk may not work as expected."
            return 0
        }
    else
        log_warn "Could not verify that port ${NEXTCLOUD_TURN_ROUTER_PORT} is mapped to this host. Some functions of Nextcloud Talk may not work as expected."
    fi
}

nextcloud_talk_install_app() {
    local existing
    existing=$(nextcloud_run_occ app:list --enabled) || {
        log_error "Failed to enumerate installed Nextcloud apps"
        return 1
    }

    if echo "$existing" | grep -q -w "spreed:"; then
        echo "The Nextcloud Talk app is already installed"
        return 0
    fi

    nextcloud_run_occ app:install spreed || {
        log_error "Failed to install Nextcloud Talk app"
        return 1
    }
}

nextcloud_talk_add_turn_server() {
    local server=${NEXTCLOUD_TURN_SUBDOMAIN}.${CF_DOMAIN_NAME}
    local port=${NEXTCLOUD_TURN_ROUTER_PORT}
    local secret=${NEXTCLOUD_TALK_TURN_SECRET}

    local existing
    existing=$(nextcloud_run_occ talk:turn:list) || {
        log_error "Failed to enumerate TURN servers in Nextcloud"
        return 1
    }

    if echo "$existing" | grep -q "$server:$port"; then
        echo -e "TURN server ${Cyan}$server:$port${COff} is already configured in Nextcloud"
        return 0
    fi

    nextcloud_run_occ talk:turn:add --secret "$secret" turn "$server:$port" udp,tcp || {
        log_error "Failed to add TURN server $server to Nextcloud"
        return 1
    }

    echo -e "TURN server ${Cyan}$server:$port{$COff} added to Nextcloud"
}

nextcloud_talk_add_signaling_server() {
    local server="https://${NEXTCLOUD_TALK_SUBDOMAIN}.${CF_DOMAIN_NAME}"
    local secret="${NEXTCLOUD_TALK_SIGNALING_SECRET}"

    local existing
    existing=$(nextcloud_run_occ talk:signaling:list) || {
        log_error "Failed to enumerate signaling servers in Nextcloud"
        return 1
    }

    if echo "$existing" | grep -q "$server"; then
        echo -e "Signaling server ${Cyan}$server${COff} is already configured in Nextcloud"
        return 0
    fi

    nextcloud_run_occ talk:signaling:add "$server" "$secret" || {
        log_error "Failed to add signaling server $server to Nextcloud"
        return 1
    }

    echo -e "Signaling server ${Cyan}$server${COff} added to Nextcloud"
}

################################################################################
#                         NEXTCLOUD SETUP HOOKS

nextcloud_talk_config_env() {
    ask_for_env NEXTCLOUD_TALK_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Nextcloud Talk signaling server"
    ask_for_env NEXTCLOUD_TURN_ENABLED "Do you want to enable the TURN server for Talk?" -o "true,false"
    if [ "$NEXTCLOUD_TURN_ENABLED" = true ]; then
        ask_for_env NEXTCLOUD_TURN_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Nextcloud Talk TURN server"
        ask_for_env NEXTCLOUD_TURN_HOST_PORT "Port in the host that will be mapped to the Nextcloud Talk TURN server container"
        ask_for_env NEXTCLOUD_TURN_ROUTER_PORT "Port in the router that will be forwarded to port ${NEXTCLOUD_TURN_HOST_PORT} on this host"
        ask_for_env NEXTCLOUD_TURN_UPNP_SLEEP "How often to reconfigure port mapping on your home router, in seconds (0=disabled)"
    fi
}

nextcloud_talk_compose_extra() {
    if [ "$NEXTCLOUD_TURN_ENABLED" = true ]; then
        echo "nextcloud.talk:$(dirname "${BASH_SOURCE[0]}")/docker-compose.turn.yml"
    fi
}

nextcloud_talk_config_secrets() {
    save_env_id NEXTCLOUD_TALK_TURN_SECRET -l 64
    save_env_id NEXTCLOUD_TALK_SIGNALING_SECRET -l 64
    save_env_id NEXTCLOUD_TALK_INTERNAL_SECRET -l 64
}

nextcloud_talk_pre_install() {
    if [ "$NEXTCLOUD_TURN_ENABLED" = true ]; then
        log_header "Preparing Nextcloud Talk TURN server for deployment"
        nextcloud_talk_configure_turn || return 1
    fi
}

nextcloud_talk_post_install() {
    log_header "Configuring Nextcloud Talk"
    nextcloud_talk_install_app || return 1
    nextcloud_talk_add_signaling_server || return 1
    if [ "$NEXTCLOUD_TURN_ENABLED" = true ]; then
        nextcloud_talk_add_turn_server || return 1
    fi
}

CONFIG_ENV_HOOKS+=("nextcloud_talk_config_env")
CONFIG_SECRETS_HOOKS+=("nextcloud_talk_config_secrets")
COMPOSE_EXTRA_HOOKS+=("nextcloud_talk_compose_extra")
PRE_INSTALL_HOOKS+=("nextcloud_talk_pre_install")
POST_INSTALL_HOOKS+=("nextcloud_talk_post_install")
# BOOTSTRAP_HOOKS+=(...)