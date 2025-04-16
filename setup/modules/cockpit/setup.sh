#!/bin/bash

if [ -n "$__SETUP_COCKPIT" ]; then return 0; fi

__SETUP_COCKPIT=1

#shellcheck source=../../lib/logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
#shellcheck source=../../lib/config.sh
source "$PROJECT_ROOT/lib/config.sh"
#shellcheck source=../../lib/cloudflare.sh
source "$PROJECT_ROOT/lib/cloudflare.sh"

DISTRO=
VERSION=
COCKPIT_SUBDOMAIN=
COCKPIT_SETUP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

################################################################################
#                            COCKPIT CONFIGURATION

cockpit_network_workaround() {
    # See: https://cockpit-project.org/faq#error-message-about-being-offline

    if [[ "$DISTRO" != "ubuntu" && "$DISTRO" != "debian" ]]; then
        return 0
    fi

    if sudo grep -q "renderer: *NetworkManager" /etc/netplan/*.yaml; then
        return 0
    fi

    local requires_restart=false

    local gmd_file="/etc/NetworkManager/conf.d/10-globally-managed-devices.conf"
    if [ ! -f "$gmd_file" ]; then
        echo -e "[keyfile]\nunmanaged-devices=none" | sudo tee "$gmd_file" > /dev/null
        requires_restart=true
    fi

    local architecture
    architecture=$(dpkg --print-architecture)
    if [ "$architecture" = "arm64" ]; then
        sudo apt install -y linux-modules-extra-raspi
    fi

    local con_name="cockpit-fake"
    local if_name="cockpit-fake0"
    if nmcli connection show | grep -q "$con_name" || ip link show "$if_name" &>/dev/null; then
        echo -e "Connection ${Purple}$con_name${COff} or interface ${Purple}$if_name${COff} already exists."
    else
        sudo nmcli con add type dummy con-name "$con_name" ifname "$if_name" ip4 1.2.3.4/24 gw4 1.2.3.1 || {
            log_error "Failed to create interface '$if_name'"
            return 1
        }
        echo -e "Interface ${Purple}$if_name${COff} created."
        requires_restart=true
    fi

    if [ "$requires_restart" = true ]; then
        log_warn "The system must be rebooted before continuing with the installation."
        build_resume_command
        if [ "$UNATTENDED" = true ]; then
            echo -e "\nThe system will reboot in 15 seconds..."
            sleep 15
            sudo shutdown -r now
            exit 1
        else
            echo ""
            read -p "Do you want to reboot now? [Y/n] " user_input </dev/tty
            user_input=${user_input:-Y}
            if [[ ! "$user_input" =~ ^[Yy]$ ]]; then
                abort_install
            fi
            sudo shutdown -r now
            exit 1
        fi
    fi
}

cockpit_detect_distribution() {
    # Detect distribution
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        log_warn "Cannot detect Linux distribution. /etc/os-release not found."
    fi

    echo -e "Detected: ${Purple}$DISTRO $VERSION${COff}"
}

cockpit_install_navigator() {
    case "$DISTRO" in
        rhel)
            if yum list installed cockpit-navigator > /dev/null 2>&1; then
                echo -e "Package ${Purple}cockpit-navigator${COff} is already installed."
                return 0
            fi
            if [[ "$VERSION" == 7* ]]; then
                sudo curl -sSL https://repo.45drives.com/lists/45drives.repo -o /etc/yum.repos.d/45drives.repo
                sudo sed -i 's/el8/el7/g;s/EL8/EL7/g' /etc/yum.repos.d/45drives.repo
                sudo yum clean all
            else
                sudo curl -sSL https://repo.45drives.com/lists/45drives.repo -o /etc/yum.repos.d/45drives.repo
                sudo dnf clean all
            fi
            sudo yum install -y cockpit-navigator
            sudo systemctl restart cockpit
            ;;
        ubuntu|debian)
            if dpkg -s cockpit-navigator > /dev/null 2>&1; then
                echo -e "Package ${Purple}cockpit-navigator${COff} is already installed."
                return 0
            fi
            wget -qO - https://repo.45drives.com/key/gpg.asc | sudo gpg --dearmor -o /usr/share/keyrings/45drives-archive-keyring.gpg
            sudo curl -sSL https://repo.45drives.com/lists/45drives.sources -o /etc/apt/sources.list.d/45drives.sources
            sudo apt update
            sudo apt install -y cockpit-navigator
            sudo systemctl restart cockpit
            ;;
        *)
            echo -e "Package ${Purple}cockpit-navigator${COff} is not supported for ${Cyan}$DISTRO${COff}."
            ;;
    esac
}

cockpit_install_service() {
    if systemctl is-active --quiet cockpit.socket; then
        echo "Cockpit is already installed."
        return 0
    fi

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
            echo "deb http://deb.debian.org/debian ${VERSION_CODENAME}-backports main" | sudo tee /etc/apt/sources.list.d/backports.list > /dev/null
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

    cockpit_detect_distribution || return 1
    cockpit_install_service || return 1
    cockpit_install_navigator || return 1
    cockpit_network_workaround || return 1
    cockpit_configure_system || return 1
    cockpit_configure_dns || return 1
}

CONFIG_ENV_HOOKS+=("cockpit_config_env")
# CONFIG_SECRETS_HOOKS+=("")
PRE_INSTALL_HOOKS+=("cockpit_pre_install")
# POST_INSTALL_HOOKS+=("")
# BOOTSTRAP_HOOKS+=("")