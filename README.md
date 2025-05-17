![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/thedebuggedlife/homevault-deployment/build_release.yml?logo=githubactions&logoColor=white)
![GitHub Tag](https://img.shields.io/github/v/tag/thedebuggedlife/homevault-deployment?logo=github&label=version)


# HomeVault Project

> [!NOTE]
> The complete documentation for this project can be found at: <br>
> https://thedebugged.life/homevault/introduction/

This project will help you bootstrap a simple but powerful home-lab server that can replace services like Google Docs and Google Photos—giving you more control, privacy, and ownership over your data.

- 📂 **Sync your documents across devices and collaborate with others** – using [Nextcloud](https://nextcloud.com/), a versatile platform that replaces Google Docs and Drive. It offers file storage, document editing, calendar sync, and other collaborative tools.
- 📸 **Store, organize, and share your photos and videos** – For photos, you will use [Immich](https://immich.app/), a powerful self-hosted alternative to Google Photos that automatically backs up and categorizes your pictures while giving you full control.
- 👥 **Manage users with access to your self-hosted applications**- Easily add new users (e.g. family or organization members) to your server and grant them access to the applications installed on the server.
- 🌐 **Access your server securely from anywhere** – Set up your own custom domain with [Cloudflare](https://www.cloudflare.com/products/registrar/) and configure secure remote access, so you can get to your data wherever you are.
- 📊 **Monitor your server 24/7** - With pre-installed tools like [Prometheus](https://prometheus.io/), [Loki](https://grafana.com/oss/loki/), and [Grafana](https://grafana.com/oss/grafana/), get a glimpse of your server activity and configure automatic alarms to notify when abnormal conditions are detected.
- 🔄 **Set up encrypted backups to AWS for peace of mind** – with automated, encrypted off-site backups to [AWS S3 Glacier](https://aws.amazon.com/s3/storage-classes/glacier/) storage, to ensure your data is protected in case of hardware failure.

## Design Principles
The following principles guide the architectural decisions and implementation of this project. These core philosophies ensure the system remains secure, maintainable, and adaptable while making it easier for administrators to deploy and manage the server and its applications.

### 1. Open Source Software
This project is built entirely on open source software components. This fundamental choice ensures transparency in how the system operates and processes data. By avoiding proprietary solutions, we eliminate vendor lock-in risks and enable community-driven improvements and security auditing. Open source also provides greater flexibility for customization to specific organizational needs without requiring expensive licensing or special permissions.

### 2. Centralized User Management
At the core of our architecture is an LLDAP server that centralizes all user identity and access management. This approach creates a single source of truth for user accounts, group memberships, and access privileges across the entire system. Administrators can efficiently manage the complete user lifecycle—from onboarding to role changes to offboarding—through a unified interface rather than configuring each application separately. This centralization significantly reduces administrative overhead while improving security by ensuring consistent access policies and immediate system-wide updates when privileges change.

### 3. Single Sign-On (SSO)
All applications hosted by the server integrate with Authelia, a self-hosted OpenID Connect provider, which securely authenticates users across all applications with the same login credentials. After logging in once, users can seamlessly navigate between different applications without reauthenticating. This creates a frictionless user experience while maintaining strong security through standardized authentication protocols. The SSO implementation also supports multi-factor authentication (MFA) that, once verified, applies across all integrated applications, balancing convenience with enhanced security posture.

### 4. Docker-Based Deployment
This project leverages Docker containers as the foundation of its deployment strategy, providing consistent, isolated environments for each application. Every service runs in its own container with precisely defined resource limits and access permissions following the principle of least privilege. Docker ensures immutable infrastructure, where configuration changes trigger new container builds rather than in-place modifications. Network communication between containers is strictly controlled through Docker's networking features, limiting each service's connectivity to only what is absolutely necessary. The containerized approach enables seamless migration between hosts, simplified backups, and rapid recovery in case of failures. By standardizing on Docker, the system achieves better security isolation, dependency management, and operational consistency compared to traditional installation methods.

### 5. Infrastructure as Code
All system components, configurations, and deployment processes are defined as code using tools like Docker Compose, shell scripts, and configuration files. This approach ensures consistency between environments and enables version-controlled, repeatable deployments. Infrastructure modifications are applied using the same automated deployment processes, reducing configuration drift and human error. By treating infrastructure as code, the entire system becomes self-documenting and can be recreated reliably on new hardware when needed, making disaster recovery more predictable and efficient.

### 6. Monitoring and Automated Maintenance
This project integrates powerful monitoring and automated maintenance tools to make it simple to inspect system performance and reliability. Prometheus, Loki, and Grafana work together to provide real-time visibility into system metrics, logs, and performance through intuitive dashboards that highlight potential issues even as soon as they start happening. Automated update mechanisms continuously monitor Docker containers for available security patches and improvements, with the option of applying those updates without manual intervention. This approach minimizes administrative overhead while maximizing system uptime and security through early detection and rapid remediation of potential problems.