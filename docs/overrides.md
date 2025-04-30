# Environment Overrides

The setup script for this project provides safe default values for many of the configuration options available. You may provide different values when answering the prompts from the script, if you are running in [interactive mode](../README.md#setup-mode-interactive-with-safe-defaults-recommended)). 

If you are running in [unattended mode](../README.md#setup-mode-unattended), you can provide overrides for these options using the `-o` command line switch. The available options are the following:

## Required settings

| Setting | Meaning |
|---------|---------|
| TAILSCALE_API_KEY | [API Key for Tailscale](./tailscale.md#3-create-an-api-token) |
| CF_DNS_API_TOKEN | [API Token for Cloudflare](./cloudflare.md#3-get-a-token-to-manage-your-cloudflare-dns-zone) |
| CF_DOMAIN_NAME | [Domain name registered with Cloudflare](./cloudflare.md#2-register-a-domain-with-cloudflare) |
| SMTP2GO_API_KEY | [API Key for SMTP2GO](./smtp.md#2-create-an-api-token) (optional, see below) |

If you are not using SMTP2GO, you will also need to provide the following required settings:

| Setting | Meaning |
|---------|---------|
| SMTP_SERVER | Address to your SMTP server (e.g. smtp.google.com) |
| SMTP_PORT | Port to connect to on your SMTP server (e.g. 587) |
| SMTP_USERNAME | Username to authenticate with your SMTP server |
| SMTP_PASSWORD | Password to authenticate with your SMTP server |

## Optional settings

| Setting | Default | Meaning |
|---------|---------|---------|
| TZ | America/Los_Angeles | Default time zone for apps installed in the server |
| APPDATA_LOCATION | /srv/appdata | Location where configuration for installed apps will be stored |
| INSTALLER_UID | (UID of current user) | User ID under which some applications will run by |
| DOCKER_GID | (GUID of docker) | Group ID under which some applications will run by |
| CF_TUNNEL_NAME | self-host | Name for the tunnel in Cloudflare. The value has no impact on functionality of the server. |
| SMTP_SENDER | noreply | Email alias used to send emails from your custom domain (i.e. value that appears before `@domain.com`) |
| AUTHELIA_THEME | dark | Theme for the authentication page used by apps in the server. Either `dark` or `light` |
| IMMICH_SUBDOMAIN | immich | Subdomain used to access the Immich site on the server. (i.e. value that appears before `.domain.com`)
| NEXTCLOUD_SUBDOMAIN | nextcloud | Subdomain used to access the NextCloud site on the server. (i.e. value that appears before `.domain.com`)
| COLLABORA_SUBDOMAIN | office | Subdomain used to access the Collabora site on the server. (i.e. value that appears before `.domain.com`)
| PORTAINER_SUBDOMAIN | portainer | Subdomain used to access the Portainer site on the server. (i.e. value that appears before `.domain.com`)
| GRAFANA_SUBDOMAIN | grafana | Subdomain used to access the Grafana site on the server. (i.e. value that appears before `.domain.com`)
| HOMEPAGE_SUBDOMAIN | homepage | Subdomain used to access the Homepage site on the server. (i.e. value that appears before `.domain.com`)
| COCKPIT_SUBDOMAIN | cockpit | Subdomain used to access the Cockpit site on the server. (i.e. value that appears before `.domain.com`)