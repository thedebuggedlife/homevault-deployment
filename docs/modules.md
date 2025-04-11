# Project Organization

This document explains how services are organized in this project, which allows you to easily install and manage multiple self-hosted services using a single setup script.

## Modular Architecture

The project is structured using a modular approach where services are grouped into logical modules that can be installed independently (with some exceptions). This design provides flexibility, allowing you to install only the services you need while maintaining a cohesive environment.

## Base Module

The Base Module is the foundation of the entire system and is **required** for all installations. It provides core functionality and services needed by all other modules.

### Services included in the Base Module:

- **Traefik**: Reverse proxy that handles routing and SSL termination
- **Authelia**: Authentication and authorization server
- **LLDAP**: Lightweight LDAP server for user management
- **Cloudflared**: Secure tunneling service (optional but included in base)
- **Monitoring tools**: Basic system monitoring

The Base Module establishes the environment that all other modules build upon, handling critical functions like authentication, networking, and security.

## Additional Modules

Beyond the Base Module, you can choose to install any combination of the following modules based on your needs:

### Immich Module

> Add this module on your installation by including the `-m immich` switch when running `setup.sh`

A modern self-hosted photo and video backup solution.

**Services included:**
- Immich (all components)
- PostgreSQL (dedicated instance for Immich)
- Redis (for caching and message queuing)

### Nextcloud Module

> Add this module on your installation by including the `-m nextcloud` switch when running `setup.sh`

Comprehensive file sharing and collaboration platform.

**Services included:**
- Nextcloud app server
- MariaDB (dedicated database)
- Elasticsearch (for improved search functionality)
- Redis (for caching and file locking)
- Collabora (for real-time collaboration on shared documents

## How Modules Work Together

All modules leverage the authentication and networking provided by the Base Module. When you install multiple modules, they can communicate with each other as needed while maintaining logical separation.

For example:
- The reverse proxy from the Base Module routes across the front-end services included in other modules
- The authentication system from the Base Module provides single sign-on across all services
- Shared resources are efficiently managed to minimize duplication

## Installation Process

When you run the setup script, you can choose to install all available modules in this project by including the `-m all` switch when running `setup.sh`. Otherwise, you can include `-m <module_name>` for each of the modules you want to install. The Base Module is always installed and does not need to be specified.

Once a module has been successfully deployed, the setup script is unable to remove it from your installation. You can use `docker` directly to remove the services related to that module. Future versions of the setup script may include a function to uninstall modules individually.