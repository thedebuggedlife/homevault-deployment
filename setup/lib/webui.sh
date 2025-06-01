if [ -n "$__LIB_WEBUI" ]; then return 0; fi

__LIB_WEBUI=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
# shellcheck source=./http.sh
source "$PROJECT_ROOT/lib/http.sh"
# shellcheck source=./config.sh
source "$PROJECT_ROOT/lib/config.sh"

###
# Downloads the webui files (overrides existing files!)
###
webui_download() {
    if [[ "$NO_DOWNLOAD" = true || "$PROJECT_VERSION" = "test" ]]; then return 0; fi

    local webui_url="$GH_IO_BASE_URL/webui.zip"
    local webui_path="$PROJECT_ROOT/webui"
    
    # Create webui directory if it doesn't exist
    ensure_path_exists "$webui_path" || {
        log_error "Failed to create webui directory"
        return 1
    }
    
    log "Downloading webui from ${Cyan}$webui_url${COff} ...\n"
    
    # Download and extract webui.zip
    curl -fsSL "$webui_url" \
        | sudo busybox unzip -o - -d "$webui_path" 2>&1 \
        | { grep -E "creating:|inflating:" || echo ""; } \
        | awk -F': ' '{print $2}' \
        | while read -r path; do
            full_path="${webui_path%/}/$path"
            log "Extracting: ${Purple}${full_path}${COff}"
            sudo chown "$AS_USER" "$full_path"
            if [[ "$path" == *.sh ]]; then
                log "Setting execute flag on: ${Purple}${full_path}${COff}"
                sudo chmod +x "$full_path"
            fi
        done || \
    {
        log_error "Failed to download and extract webui"
        return 1
    }
}

###
# Install nvm and Node.js v22 for the current user
###
webui_install_nvm_and_node() {
    local nvm_dir="${NVM_DIR:-"$HOME/.nvm"}"
    local node_version="22"
    
    # Check if nvm is already installed
    if [ -s "$nvm_dir/nvm.sh" ]; then
        log "NVM is already installed at ${Cyan}$nvm_dir${COff}"
    else
        log "Installing NVM ..."
        
        # Download and install nvm
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash || {
            log_error "Failed to install nvm"
            return 1
        }
    fi
    
    # Source nvm
    export NVM_DIR="$nvm_dir"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Check if Node.js v22 is installed
    if nvm list "$node_version" &>/dev/null; then
        log "Node.js v${node_version} is already installed"
    else
        log "Installing Node.js v${node_version}..."
        nvm install "$node_version" || {
            log_error "Failed to install Node.js v${node_version}"
            return 1
        }
    fi
    
    # Set Node.js v22 as default
    nvm alias default "$node_version"
    
    log "Node.js $(node --version) is ready"
}

###
# Install the backend service
###
webui_install_backend_service() {
    local backend_path="$PROJECT_ROOT/webui/backend"
    local env_file="$backend_path/.env"
    local service_name="homevault-backend"
    local nvm_dir="${NVM_DIR:-"$HOME/.nvm"}"
    local port=3001
    
    log_header "Installing WebUI Backend Service"
    
    # Stop the service if it's already running
    if sudo systemctl is-active --quiet "$service_name"; then
        log "Stopping existing backend service..."
        sudo systemctl stop "$service_name"
    fi
    
    # Create .env file for backend (preserve JWT_SECRET if file exists)
    log "Creating backend environment file..."
    local jwt_secret
    if [ -f "$env_file" ]; then
        # Preserve existing JWT_SECRET
        jwt_secret=$(grep "^JWT_SECRET=" "$env_file" | cut -d'=' -f2-)
    fi
    # Generate new secret if none exists
    jwt_secret=${jwt_secret:-$(generate_secret 32)}
    
    cat > "$env_file" <<EOF
PORT=$port
NODE_ENV=production
INSTALLER_PATH=$PROJECT_ROOT
JWT_SECRET=$jwt_secret
EOF
    
    chmod 600 "$env_file"
    
    # Install npm dependencies
    log "Installing backend dependencies..."
    export NVM_DIR="$nvm_dir"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    (
        cd "$backend_path" || return 1
        NODE_VERSION=22 nvm exec npm ci --omit=dev || {
            log_error "Failed to install backend dependencies"
            return 1
        }
    ) || return 1
    
    # Create systemd service file
    log "Creating systemd service for backend..."
    local service_file="/etc/systemd/system/${service_name}.service"
    
    sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=HomeVault WebUI Backend
After=network.target

[Service]
Type=simple
User=$AS_USER
Group=$AS_USER
WorkingDirectory=$backend_path
Environment="NODE_VERSION=22"
Environment="NVM_DIR=$nvm_dir"
ExecStart=$nvm_dir/nvm-exec node app.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$service_name

# Security settings
ProtectHome=read-only
ReadWritePaths=$PROJECT_ROOT

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and restart service
    sudo systemctl daemon-reload
    sudo systemctl enable "$service_name"
    sudo systemctl restart "$service_name"
    
    # Wait a moment and check if service started successfully
    sleep 2
    if sudo systemctl is-active --quiet "$service_name"; then
        log "Backend service ${Purple}$service_name${COff} installed and started on port ${Cyan}$port${COff}"
    else
        log_error "Backend service failed to start. Check logs with: sudo journalctl -u $service_name -n 50"
        return 1
    fi
}

###
# Install the frontend service using Python's http.server
###
webui_install_frontend_service() {
    local frontend_path="$PROJECT_ROOT/webui/frontend"
    local service_name="homevault-frontend"
    local port=3000
    local spa_server_path="$PROJECT_ROOT/webui/spa_server.py"
    
    log_header "Installing WebUI Frontend Service"
    
    # Create the SPA server script
    log "Creating SPA server script..."
    cat > "$spa_server_path" <<'EOF'
#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys
from pathlib import Path

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=kwargs.pop('directory', None), **kwargs)
    
    def do_GET(self):
        path = self.translate_path(self.path)
        
        if os.path.exists(path) and os.path.isfile(path):
            return super().do_GET()
        
        self.path = '/index.html'
        return super().do_GET()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    
    handler = lambda *args, **kwargs: SPAHandler(*args, directory=directory, **kwargs)
    
    # Use TCPServer with SO_REUSEADDR to avoid "Address already in use" errors
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True
    
    with ReusableTCPServer(("0.0.0.0", port), handler) as httpd:
        print(f"Serving SPA at http://0.0.0.0:{port} from {directory}")
        httpd.serve_forever()

if __name__ == "__main__":
    main()
EOF
    
    chmod +x "$spa_server_path"
    chown "$AS_USER:$AS_USER" "$spa_server_path"
    
    # Stop the service if it's already running
    if sudo systemctl is-active --quiet "$service_name"; then
        log "Stopping existing frontend service..."
        sudo systemctl stop "$service_name"
    fi
    
    # Create systemd service file for frontend
    log "Creating systemd service for frontend..."
    local service_file="/etc/systemd/system/${service_name}.service"
    
    sudo tee "$service_file" > /dev/null <<EOF
[Unit]
Description=HomeVault WebUI Frontend
After=network.target

[Service]
Type=simple
User=$AS_USER
Group=$AS_USER
WorkingDirectory=$frontend_path
ExecStart=/usr/bin/python3 $spa_server_path $port $frontend_path
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$service_name

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadOnlyPaths=$frontend_path
ReadOnlyPaths=$spa_server_path

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and restart service
    sudo systemctl daemon-reload
    sudo systemctl enable "$service_name"
    sudo systemctl restart "$service_name"
    
    # Wait a moment and check if service started successfully
    sleep 2
    if sudo systemctl is-active --quiet "$service_name"; then
        log "Frontend service ${Purple}$service_name${COff} installed and started on port ${Cyan}$port${COff}"
    else
        log_error "Frontend service failed to start. Check logs with: sudo journalctl -u $service_name -n 50"
        return 1
    fi
}

###
# Install both frontend and backend services
###
webui_install_services() {
    # Ensure Python3 is installed
    check_python3 || return 1

    # Ensure nvm and node are installed first
    webui_install_nvm_and_node || return 1
    
    # Install backend
    webui_install_backend_service || return 1
    
    # Install frontend
    webui_install_frontend_service || return 1

    # Persist the fact that the WEBUI has been installed
    save_env WEBUI_INSTALLED true

    log "\n${BIGreen}WebUI installed successfully${COff}\n"
}

webui_configure_dns() {
    if ! zone_id=$(cloudflare_get_zone_id "$CF_DOMAIN_NAME"); then
        return 1
    fi
    cloudflare_add_or_update_record "$zone_id" A "$WEBUI_SUBDOMAIN.$CF_DOMAIN_NAME" "$TAILSCALE_IP" false || {
        return 1
    }
}

webui_print_status() {
    local is_public=$1

    # Get LAN IP for display
    local lan_ip
    lan_ip=$(get_lan_ip)

    log_header "WebUI Location"
    log "Internal: ${Cyan}http://$lan_ip:3000${COff}"
    if [ "$is_public" = true ]; then
        log "External: ${Cyan}https://$WEBUI_SUBDOMAIN.$CF_DOMAIN_NAME${COff}"
    fi
    log "\nTo check service status:\n"
    log "  ${Purple}sudo systemctl status homevault-frontend${COff}"
    log "  ${Purple}sudo systemctl status homevault-backend${COff}"
    log "\nTo view logs:\n"
    log "  ${Purple}sudo journalctl -u homevault-frontend -f${COff}"
    log "  ${Purple}sudo journalctl -u homevault-backend -f${COff}"
}