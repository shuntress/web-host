# Web Host
A web server that uses [Node](https://nodejs.org/)'s built-ins to handle:
 - static content (filesystem index)
 - dynamic content (server-side javascript)
 - secure authentication ([HTTP Basic](https://tools.ietf.org/html/rfc7617), [TLS](https://tools.ietf.org/html/rfc8446), [pbkdf2](https://tools.ietf.org/html/rfc8018))
 - simple authorization (No groups, roles, or regex matches)

## What is this?
It's my take on a practical minimalist web host with code that
can be understood in an hour and run directly from
source with no dependencies ([one dependency](https://nodejs.org)).

To that end, you may notice that there are no package, grunt, trevor, cargo,
slurp, scarf, jarvis, babel, lint, or docker files. The .git folder is the only dev
tool sub-directory.

The setup script targets [systemd](https://systemd.io/) to install this software as a persistent service but the project is otherwise system-agnostic.

## Why?
Small-scale web publishing should be simple.

A CS degree should not feel required to self-host your resume, blog, or photos.

# Quick Start
**Install Node**: [https://nodejs.org/](https://nodejs.org/)

**Download and extract the source code**: [https://github.com/shuntress/web-host/archive/main.zip](https://github.com/shuntress/web-host/archive/main.zip)  
*(alternatively, you can use [Git](https://git-scm.com/downloads) to clone the repository: `git clone https://github.com/shuntress/web-host.git`)*  

**Navigate to your install location**: `cd {path/on/your/system/to/web-host-main}`  
*(the folder will be named `web-host-main` if you downloaded the archive zip file. It will be named `web-host` if you cloned the repository without changing its name)*

**Run the site**: `node src/site.js`

**Check the status page**: [http://localhost/status](http://localhost/private/status)

**Add some test content**: `echo "test file, please ignore" > content/testfile.txt`  
[http://localhost/testfile.txt](http://localhost/testfile.txt)

---

## Slightly Slower Start

This builds on the quick start by adding a certificate to enable HTTPS and user authentication/authorization.  
*This part does feel like CS degree stuff but is only necessary if you want to enable secure access control.*  
*If you are OK with everything being public, you can ignore this.*

**Create your certificate**: `openssl req -newkey rsa:2048 -nodes -keyout administration/key.pem -x509 -days 365 -out administration/certificate.pem`  
*You can use [openssl](https://www.openssl.org/) to generate your own un-trustworthy certificate or have a certificate generated by trusted source like [letsencrypt](https://letsencrypt.org/getting-started/)*  
*If this step is confusing, read up on [TLS](https://en.m.wikipedia.org/wiki/Transport_Layer_Security) and [Public Key Cryptography](https://en.m.wikipedia.org/wiki/Public-key_cryptography).*  


**Enable HTTPS**: Create `administration/config.json` with the following content: 
```
{
   "useHttps": true
}
```
*This also automatically redirects all HTTP traffic.*

**Add a some test private content**
 - `mkdir content/private`
 - `echo "private test file" > content/private/testfile.txt`

[https://localhost/private/testfile.txt](https://localhost/private/testfile.txt)  
*This should fail because you have no login.*

**Request a new account**: [https://localhost/account](https://localhost/account)

**Approve your request**: Copy the contents of `administration/account_creation_requests.txt` to `administration/user_credentials.txt`.  
*User credentials are loaded once during initialization. If `user_credentials.txt` is missing, it will be created automatically.*

**Restart the site**: `CTRL+C` then `node src/site.js`.

**Check the status page**: [https://localhost/status](https://localhost/private/status)

## Authorization
When HTTPS is enabled, resources may be setup to require authorization.

### Blanket privacy
Any URL with `private` in the path will require the user to log in.

### Resource-specific privacy
Authorization may be further specified per-directory by adding a newline-separated list of user names in a file called `.authorized_users`.

When any static resource is requested, the index module will recurse up the tree towards the root looking for an `.authorized_users` file.  
If no `.authorized_users` file is found, the request will be **accepted**.  
If the first `.authorized_users` lists the user's name, the request will be **accepted**.  
If the first `.authorized_users` does not list the user's name, the request will be **rejected**.

If a list of authorized users exists for a resource that does not have `private` in the path, the user will be prompted to login because a name is required for authorization.

## Firewall Settings
Networking can easily get overcomplicated.

The extremely simplified and generally "good enough" version is that your house has an internet address similar to its street address and your modem/router is like the mailbox to receive messgaes at your address.

In order for people outside your home network to access your server, you need to configure the "mailbox" to pass certain correspondence appropriately. Like sending to a specific unit number in a large building.

Specifically, you want inbound and outbound TCP traffic on ports 80 and 443 to go to the machine running your server.

How this is actually accomplished will vary slightly depending on your specific hardware but most commonly this will be done by connecting to [http://192.168.1.1](http://192/168.1.1) and logging in using the credentials printed on a sticker stuck to the side of your ISP-provided router/modem.

## Configuration Options
Config defaults are in [src/config.js](https://github.com/shuntress/web-host/blob/main/src/config.js).

Defaults may be overridden by setting the corresponding property in `administration/config.json`
