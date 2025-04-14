if [ -n "$__SETUP_COCKPIT" ]; then return 0; fi

__SETUP_COCKPIT=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/cloudflare.sh
source "$PROJECT_ROOT/lib/cloudflare.sh"

COCKPIT_SUBDOMAIN=
COCKPIT_SETUP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

################################################################################
#                            COCKPIT CONFIGURATION

#!/bin/bash

cockpit_install_service() {
    if systemctl is-active --quiet cockpit.socket; then
        echo "Cockpit is already installed."
        return 0
    fi

    # Detect distribution
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        echo "Cannot detect Linux distribution. /etc/os-release not found."
        return 1
    fi
    
    echo "Detected: $DISTRO $VERSION"
    
    case "$DISTRO" in
        fedora)
            echo "Installing Cockpit on Fedora..."
            sudo dnf install -y cockpit
            sudo systemctl enable --now cockpit.socket
            # Open firewall if firewalld is running
            if systemctl is-active --quiet firewalld; then
                sudo firewall-cmd --add-service=cockpit --permanent
                sudo firewall-cmd --reload
            fi
            ;;
            
        rhel)
            # RHEL 8 or later
            echo "Installing Cockpit on RHEL..."
            if [[ "$VERSION" == 7* ]]; then
                sudo subscription-manager repos --enable rhel-7-server-extras-rpms
            fi
            sudo yum install -y cockpit
            sudo systemctl enable --now cockpit.socket
            # Open firewall if firewalld is running
            if systemctl is-active --quiet firewalld; then
                sudo firewall-cmd --add-service=cockpit --permanent
                sudo firewall-cmd --reload
            fi
            ;;

        centos)
            # CentOS
            echo "Installing Cockpit on CentOS..."
            sudo yum install -y cockpit
            sudo systemctl enable --now cockpit.socket
            # Open firewall if firewalld is running
            if systemctl is-active --quiet firewalld; then
                sudo firewall-cmd --permanent --zone=public --add-service=cockpit
                sudo firewall-cmd --reload
            fi
            ;;
            
        ubuntu)
            echo "Installing Cockpit on Ubuntu..."
            . /etc/os-release
            sudo apt install -y -t ${VERSION_CODENAME}-backports cockpit
            ;;

        debian)
            echo "Installing Cockpit on Debian..."
            . /etc/os-release
            sudo echo "deb http://deb.debian.org/debian ${VERSION_CODENAME}-backports main" > \
                /etc/apt/sources.list.d/backports.list
            sudo apt update
            sudo apt install -y -t ${VERSION_CODENAME}-backports cockpit
            ;;
            
        arch)
            echo "Installing Cockpit on Arch Linux..."
            sudo pacman -Sy --noconfirm cockpit
            sudo systemctl enable --now cockpit.socket
            ;;
            
        suse|opensuse|opensuse-leap|opensuse-tumbleweed)
            echo "Installing Cockpit on openSUSE..."
            sudo zypper install -y cockpit
            sudo systemctl enable --now cockpit.socket
            # Open firewall if firewalld is running
            if systemctl is-active --quiet firewalld; then
                firewall-cmd --add-service=cockpit --permanent
                firewall-cmd --reload
            fi
            ;;
            
        flatcar)
            echo "Flatcar Container Linux has Cockpit pre-installed."
            echo "Make sure the Cockpit socket is enabled:"
            systemctl enable --now cockpit.socket
            # Open firewall if firewalld is running
            if systemctl is-active --quiet firewalld; then
                firewall-cmd --add-service=cockpit --permanent
                firewall-cmd --reload
            fi
            ;;
            
        *)
            log_error "Unsupported distribution for Cockpit: $DISTRO"
            return 1
            ;;
    esac
    
    # Check if installation was successful
    if systemctl is-active --quiet cockpit.socket; then
        echo "Cockpit has been successfully installed and enabled."
    else
        log_warn "Cockpit installation completed, but the service is not running."
    fi
}

cockpit_configure_system() {
    local cockpit_socket_file="/etc/systemd/system/cockpit.socket.d/listen.conf"
    if [ ! -f "$cockpit_socket_file" ]; then
        echo -e "Creating file ${Cyan}$cockpit_socket_file${COff}..."
        sudo mkdir -p "$(dirname ${cockpit_socket_file})"
        sudo cp "$COCKPIT_SETUP_DIR/listen.conf" "$cockpit_socket_file"
        sudo systemctl daemon-reload
        sudo systemctl restart cockpit.socket
    fi
    local cockpit_conf_file="/etc/cockpit/cockpit.conf"
    if [ ! -f "$cockpit_conf_file" ]; then
        echo -e "Creating file ${Cyan}$cockpit_conf_file${COff}..."
        sudo mkdir -p "$(dirname ${cockpit_conf_file})"
        sudo cp "$COCKPIT_SETUP_DIR/cockpit.conf" "$cockpit_conf_file"
    fi
    local origins="http://$COCKPIT_SUBDOMAIN.$CF_DOMAIN_NAME ws://$COCKPIT_SUBDOMAIN.$CF_DOMAIN_NAME https://$COCKPIT_SUBDOMAIN.$CF_DOMAIN_NAME wss://$COCKPIT_SUBDOMAIN.$CF_DOMAIN_NAME"
    echo -e "Updating ${Purple}Origins${COff} value in ${Cyan}$cockpit_conf_file${COff}..."
    sudo sed -i -E "s|^Origins=.*|Origins=${origins}|" "$cockpit_conf_file" || {
        log_error "Failed to update 'Origins' in '$cockpit_conf_file'"
        exit 1
    }
    sudo systemctl restart cockpit
}

cockpit_configure_dns() {
    if ! zone_id=$(cloudflare_get_zone_id "$CF_DOMAIN_NAME"); then
        return 1
    fi
    cloudflare_add_or_update_record "$zone_id" A "$COCKPIT_SUBDOMAIN.$CF_DOMAIN_NAME" "$TAILSCALE_IP" false || {
        return 1
    }
}

################################################################################
#                          COCKPIT SETUP HOOKS

cockpit_config_env() {
    ask_for_env COCKPIT_SUBDOMAIN "Subdomain under ${CF_DOMAIN_NAME} to use for Cockpit"
}

cockpit_pre_install() {
    log_header "Configuring Cockpit"

    cockpit_install_service
    cockpit_configure_system
    cockpit_configure_dns
}

CONFIG_ENV_HOOKS+=("cockpit_config_env")
# CONFIG_SECRETS_HOOKS+=("")
PRE_INSTALL_HOOKS+=("cockpit_pre_install")
# POST_INSTALL_HOOKS+=("")
# BOOTSTRAP_HOOKS+=("")