# HomeVault Deployment

Deploying and configuring the applications supported by HomeVault is done via the **vh** script. There are multiple modes of operation of the script. For a basic walk-through, take a look at the [main documentation page](https://thedebugged.life/homevault/deployment/) for the project.

Regardless of your deployment scenario, you have to first download the script to your server in order to run it locally. To do that, run the following:

```bash
mkdir -p ~/homevault/workspace
cd ~/homevault/workspace
curl -fsSL https://github.com/thedebuggedlife/homevault-deployment/releases/latest/download/setup.zip | busybox unzip -n -
chmod +x hv
```

The rest of this document will review more advanced deployment scenarios.

## Forced Interactive Mode

By default, the **hv** script uses safe defaults for configurable parameters, when available. Parameters that have no default values (for example API Keys or passwords) will show a prompt to enter the value (interactively). If you would like the script to prompt for all values, even those that have a safe default or that have been previously configured, you can add the `--always-ask` flag. For example:

```bash
# To install ALL available applications and be prompted for ALL available parameters
cd ~/homevault/workspace
./hv deploy -m all --always-ask
```

## Unattended Mode

In this mode, the script will not stop to ask any questions. All necessary information to perform the deployment must be provided at the time the script is invoked. To do this, you can specify the necessary values using the `-o` or `--override` flag. For example:

```bash
# Invoke the script providing all required overrides
cd ~/homevault/workspace
./hv deploy -m all --unattended \
    -o TAILSCALE_API_KEY=... \
    -o CF_DNS_API_TOKEN=... \
    -o CF_DOMAIN_NAME=... \
    -o SMTP2GO_API_KEY=... \
    -o ADMIN_USERNAME=... \
    -o ADMIN_EMAIL=... \
    -o ADMIN_PASSWORD=... \
    -o "ADMIN_DISPLAY_NAME=..."
```

The following is a list of configuration values that can be provided via the `--override` flag. The first time you run a deployment in unattended mode, you must provide an override for all the values that do not have a default. If you're running the script again after a successful deployment (for example to add or remove modules) you do not need to specify the overrides again.

|Configuration|Purpose|Default|App module|
|-|-|-|-|
|`APPDATA_LOCATION`|Path where application data will be stored|`/srv/appdata`|base|
|`TZ`|Local Timezone (see [valid values](https://timeapi.io/documentation/iana-timezones))|`America/Los_Angeles`|base|
|`ADMIN_USERNAME`|Username for main server user||base|
|`ADMIN_EMAIL`|Email for the main server user||base|
|`ADMIN_PASSWORD`|Password for the main server user||base|
|`ADMIN_DISPLAY_NAME`|Full name for the main server user||base|
|`TAILSCALE_API_KEY`|API Key for Tailscale (see [pre-requisites](https://thedebugged.life/homevault/pre-requisites/))||base|
|`CF_DOMAIN_NAME`|DNS name registered in Cloudflare (see [pre-requisites](https://thedebugged.life/homevault/pre-requisites/))||base|
|`CF_DNS_API_TOKEN`|API Token for Cloudflare (see [pre-requisites](https://thedebugged.life/homevault/pre-requisites/))||base|
|`USE_SMTP2GO`|Whether to send email via SMTP2GO (see [pre-requisites](https://thedebugged.life/homevault/pre-requisites/))|`true`|base|
|`SMTP2GO_API_KEY`|API Key for SMTP2GO (see [pre-requisites](https://thedebugged.life/homevault/pre-requisites/))||base|
|`SMTP_SENDER`|Email to use when sending automated emails **without `@domain.com`**|`noreply`|base|
|`SMTP_SERVER`|SMTP server host (optional if using SMTP2GO)||base|
|`SMTP_PORT`|SMTP server port (optional if using SMTP2GO)||base|
|`SMTP_USERNAME`|SMTP server username (optional if using SMTP2GO)||base|
|`SMTP_PASSWORD`|SMTP server password (optional if using SMTP2GO)||base|
|`SMTP_SECURE`|Whether to use `ssl` or `tls`|`tls`|base|
|`AUTHELIA_THEME`|Theme for Authelia, `dark` or `light`|`dark`|base|
|`IMMICH_SUBDOMAIN`|Subdomain to use for Immich|`immich`|immich|
|`IMMICH_UPLOAD_LOCATION`|Path where Immich will store uploaded photos|`/usr/local/immich`|immich|
|`IMMICH_DEFAULT_QUOTA`|How much space is granted to each Immich user (in GB)|`200`|immich|
|`NEXTCLOUD_SUBDOMAIN`|Subdomain to use for Nextcloud|`immich`|nextcloud|
|`NEXTCLOUD_DATA_LOCATION`|Path where Nextcloud will store uploaded data|`/usr/local/nextcloud`|nextcloud|
|`NEXTCLOUD_DEFAULT_QUOTA`|How much space is granted to each Nextcloud user|`200`|nextcloud|
|`NEXTCLOUD_FTS_MEMORY_LIMIT`|How much RAM to allocate for Full-Text Search|`2g`|nextcloud|
|`COLLABORA_SUBDOMAIN`|Subdomain for Collabora (Nextcloud Office)|`office`|nextcloud|
|`NEXTCLOUD_TALK_SUBDOMAIN`|Subdomain for Nextcloud Talk|`talk`|nextcloud.talk|
|`NEXTCLOUD_TURN_ENABLED`|If `true`, a [TURN server](https://nextcloud-talk.readthedocs.io/en/latest/TURN/) will be included in the deployment|`false`|nextcloud.talk|
|`NEXTCLOUD_TURN_SUBDOMAIN`|Subdomain for Nextcloud TURN server|`turn`|nextcloud.talk|
|`NEXTCLOUD_TURN_HOST_PORT`|Port on the server that will listen for TURN connections|`3478`|nextcloud.talk|
|`NEXTCLOUD_TURN_ROUTER_PORT`|Port on your home router that will listen for TURN connections|`3478`|nextcloud.talk|
|`NEXTCLOUD_TURN_UPNP_SLEEP`|How often (seconds) to reconfigure port forwarding for TURN on your home router|`900`|nextcloud.talk|
|`PROMETHEUS_RETENTION_TIME`|How many days of metrics to retain in Prometheus|`90d`|monitoring|
|`PROMETHEUS_RETENTION_SIZE`|Maximum amount of data to store in Prometheus|`150GB`|monitoring|
|`LOKI_RETENTION_TIME`|How many days of logs to retain in Loki|`15d`|monitoring|
|`GRAFANA_SUBDOMAIN`|Subdomain for Grafana|`grafana`|monitoring|
|`PORTAINER_SUBDOMAIN`|Subdomain for Portainer|`portainer`|portainer|
|`HOMEPAGE_SUBDOMAIN`|Subdomain for Homepage|`home`|homepage|
|`COCKPIT_SUBDOMAIN`|Subdomain for Cockpit|`cockpit`|cockpit|
