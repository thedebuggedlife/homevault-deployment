# Tailscale Account Setup

It is always useful to have access to tools that can let us manage our server, whether at home or remotely. However, we want to make sure that access to these tools is extra secure. For this project, we are going to use [Tailscale](https://tailscale.com/) to accomplish this. With Tailscale, we will be use a VPN network to ensure only other personal devices (e.g. a laptop or phone) can reach certain access points on our server.

## Tailscale VPN

Tailscale is a peer-to-peer virtual private network (VPN) solution that allows you to create a secure, private network between your devices—no matter where they are. Unlike traditional VPNs, which require complex setup and dedicated servers, Tailscale is built on top of the WireGuard protocol and works seamlessly by connecting devices directly to each other using encrypted tunnels. This peer-to-peer architecture minimizes latency and provides fast, secure access without the need for manual firewall or NAT configuration.

![](https://thedebugged.life/content/images/2025/02/homeseer-direct-access-tailscale.drawio.png)

Learn more about Tailscale at https://thedebugged.life/direct-access-for-homeseer/

## Step by Step Guide

### 1. Create Tailscale account

Signing up for Tailscale is free. Tailscale integrates with most major identity providers, like Google, Microsoft, Apple. When you sign up, you will be automatically enrolled in the free plan, which includes all the functionality we need for this project.

To create your account, head to: https://login.tailscale.com/start

### 2. Install Tailscale on personal devices

You only need to install Tailscale on devices that you wish to access the administrator functions of your server, like opening a remote terminal via SSH, or managing users via LLDAP. In most cases, this will be only a single device, such as your primary laptop.

To install Tailscale:

- Go to https://tailscale.com/download
- Select the right version based on your OS
- Authenticate with your Google/Microsoft account
- Connect your device

### 3. Create an API Token

- Log into your Tailscale dashboard and go to the [Keys section](https://login.tailscale.com/admin/settings/keys) under Settings
- Click on the button **Generate access token**
- Add a description for your key (e.g. "Self host setup") and give it an expiration time (we only need this key during project setup)

> #### !! Copy the access token and save it somewhere you can access it later !! (e.g. _Notepad_)