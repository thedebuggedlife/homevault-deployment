# Project: Base + Immich + NextCloud

This project will help you bootstrap a simple but powerful home-lab server that can replace services like Google Docs and Google Photos—giving you more control, privacy, and ownership over your data.

- 📂 **Self-host your documents and collaborate** – We’ll use [Nextcloud](https://nextcloud.com/), a versatile platform that replaces Google Docs and Drive. It offers file storage, document editing, calendar sync, and other collaborative tools.
- 📸 **Store, organize, and share your photos securely** – For photos, we’ll set up [Immich](https://immich.app/), a powerful self-hosted alternative to Google Photos that automatically backs up and categorizes your pictures while giving you full control.
- 👥 **Manage users with access to your self-hosted applications**- Easily add new members to your server and grant them access to Immich or Nextcloud.
- 🌐 **Access your server securely from anywhere** – We’ll guide you through the process of setting up your own custom domain with [Cloudflare](https://www.cloudflare.com/products/registrar/) and configuring secure remote access, so you can get to your data wherever you are.
- 🔄 **Set up encrypted backups to AWS for peace of mind** – We’ll configure automated, encrypted off-site backups to [AWS S3 Glacier](https://aws.amazon.com/s3/storage-classes/glacier/) storage to ensure your data is protected in case of hardware failure.

![](./services.drawio.png)

## Pre-requisites

In order to setup your self-hosted solution, you will need to take some preparation steps:

1. **[Hardware](docs/hardware.md)**- Buy and/or build a server to host your applications. Review this document for some recommendations.
2. **Linux**- A recent distribution of Linux. I recommend installing [Ubuntu Server](https://ubuntu.com/download/server) version 24.04 (or latest LTS)
3. **SSH Client**- A computer with an SSH client that we can use to connect to your server for administration. I recommend [Termius](https://termius.com/)
4. **[Cloudflare](docs/cloudflare.md)**- An account and domain registered with Cloudflare. We will also use their DNS and Zero Trust Tunnel services which are included in their FREE tier. Follow the steps in this document to get your account properly setup.
5. **[Tailscale](docs/tailscale.md)**- An account registered with Tailscale. We will create a VPN mesh network (Tailnet) to remotely access our server for administration. Follow the steps in this document to get your account properly setup.

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