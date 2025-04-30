# Selfhost Bootstrap Project

This project will help you bootstrap a simple but powerful home-lab server that can replace services like Google Docs and Google Photos—giving you more control, privacy, and ownership over your data.

- 📂 **Sync your documents across devices and collaborate with others** – using [Nextcloud](https://nextcloud.com/), a versatile platform that replaces Google Docs and Drive. It offers file storage, document editing, calendar sync, and other collaborative tools.
- 📸 **Store, organize, and share your photos and videos** – For photos, you will use [Immich](https://immich.app/), a powerful self-hosted alternative to Google Photos that automatically backs up and categorizes your pictures while giving you full control.
- 👥 **Manage users with access to your self-hosted applications**- Easily add new users (e.g. family or organization members) to your server and grant them access to the applications installed on the server.
- 🌐 **Access your server securely from anywhere** – Set up your own custom domain with [Cloudflare](https://www.cloudflare.com/products/registrar/) and configure secure remote access, so you can get to your data wherever you are.
- 📊 **Monitor your server 24/7** - With pre-installed tools like [Prometheus](https://prometheus.io/), [Loki](https://grafana.com/oss/loki/), and [Grafana](https://grafana.com/oss/grafana/), get a glimpse of your server activity and configure automatic alarms to notify when abnormal conditions are detected.
- 🔄 **Set up encrypted backups to AWS for peace of mind** – with automated, encrypted off-site backups to [AWS S3 Glacier](https://aws.amazon.com/s3/storage-classes/glacier/) storage, to ensure your data is protected in case of hardware failure.

![](./services.drawio.png)

Additional documentation: https://thedebugged.life/bootstrap/bootstrap-project/