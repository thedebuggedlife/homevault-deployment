# SMTP Account Setup

Some of the services we will be setting up as part of this project have the ability to send automated emails. For example:

- **Authelia**, our Single Sign On (SSO) solution, can send password-recovery emails to existing users.
- **Immich**, our photo management solution, allow us to send emails when sharing a photo album with other people.
- **Nextcloud**, our file management and collaboration solution, also allow us to send emails when sharing content with other people.

It is possible to configure the server to use an SMTP service like GMail, Outlook.com. However, a more polished solution is to send email from our own domain (e.g. `administrator@mydomain.com`). This is possible, easy to configure, and free, using a service called [SMTP2GO](https://www.smtp2go.com/)

> You can also use your SMTP2GO account to send and receive emails from your personal GMail inbox using a custom email address, like `my.name@example.com`. If this is something you're interested in, you can find more details on how to set it up here: https://thedebugged.life/custom-email-domain-with-gmail/

## Step by Step Guide

### 1. Create an account

You will need to open a new account with SMTP2GO, which includes enough capacity in its free tier for our use case.

To open your account, head to: https://www.smtp2go.com/

### 2. Create an API token

The setup script on this project takes care of configuring your SMTP2GO account and validate your Cloudflare domain, which is a pre-requisite to sending email from a custom domain. In order for this process to be automated, you just need to provide an API token during configuration. 

In order to get the token:

- Log into your [SMTP2GO account](https://app.smtp2go.com/)
- On the left-side menu, expand the **Sending** section and click on **API Keys**
- On the main section of the screen, find and click on the **Add API Key** button
- Under **Details**, enter a meaningful description for the key (e.g. "Self-host service administration")
- Switch to the **Permissions** tab
- Modify permissions so that _only the following ones_ remain enabled:
    - Sender Domains
    - SMTP Users
- Click on **Add API Key**
- Back on the **API Keys** page click on the **Copy** button.

> #### !! Save your API Key somewhere you can access it later !! (e.g. _Notepad_)

## Using a Different SMTP Server

If you want to configure your project to use a different SMTP Server, when running the configuration script add the option `--custom-smtp`, like:

```
./setup.sh --custom-smtp
```

If you do this, you will be asked, during the configuration phase, to provide values for SMTP user, password, server address and port.