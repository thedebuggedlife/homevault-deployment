# Immich Configuration

This project includes Immich as one of the applications installed into your server. Immich is a high-performance, self-hosted photo and video management solution, often touted as a Google Photos alternative, allowing users to store and manage their media on their own infrastructure. 

## Post-Install Bootstrap

The setup script includes a post-install bootstrap step that will configure Immich to work with the rest of the infrastructure set by this project. Specifically:

- Using your SMTP settings to send user notifications
- Integrate with Authelia for Single Sign On (SSO) authentication

### Getting an API Token

In order to perform the bootstrap steps, the script needs an API Key created from the Immich webpage. After the initial deployment, you will be able to get an API token following these steps:

1. Create an account on Immich. The script will provide the address based on your configuration.

:warning: When creating an account on Immich during first login, use the same username and email you provided for the primary user. **This is very important for things to work properly afterwards!**

2. Click on the user menu (round profile icon with your initials on the top-left corner)
3. Select **Account Settings**
4. Under **API Keys** click on **Create new key**
5. Enter a description (e.g. `Selfhost bootstrap`) and click **Create**
6. Copy the key value into the script prompt