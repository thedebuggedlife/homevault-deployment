# Project: Base + Immich + NextCloud

This project provides the foundational setup for your self-hosted infrastructure, offering a robust yet flexible solution to securely manage both public and internal services. Leveraging industry-standard tools, this setup addresses common infrastructure needs, including secure access, authentication, and DNS management.

## What's Included?

- 🌐 **Cloudflare Tunnels:** Securely expose your services to the public internet.
- 🛡️ **Tailscale:** Easily manage and secure internal service networking.
- 🔄 **Traefik:** Powerful reverse proxy and load balancing.
- 🔑 **Authelia:** Advanced authentication, authorization, and Single Sign-On (SSO).
- 📡 **TrafegoDNS:** Automatic DNS record management.
- 👥 **LLDAP:** Lightweight user and group identity management.
- 📸 **Immich:** Self-hosted photo and video management solution.
- 📂 **Nextcloud:** Solution for self-hosted file sharing services. Nextcloud provides functionality similar to Dropbox, Office 365, or Google Drive.

## Pre-requisites

## Configuration and Deployment

Run the provided script to effortlessly bootstrap the entire environment:

```bash
mkdir -p ~/self-host/base
cd ~/self-host/base
wget -qO setup.sh https://raw.githubusercontent.com/thedebuggedlife/selfhost-bootstrap/refs/heads/main/projects/base-immich-nextcloud/setup.sh
chmod +x setup.sh
./setup.sh
```

This will deploy and configure all necessary components, providing you a fully operational setup within minutes.

## Customization

This setup is designed to be opinionated yet easily customizable. Feel free to adjust the configuration files according to your particular infrastructure requirements.

==TBD==