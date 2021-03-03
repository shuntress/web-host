
## What is this?
A small web host that uses only node's built-ins to handle:
 - static content (filesystem index)
 - dynamic content (server-side javascript)
 - secure authentication ([HTTP authentication](https://tools.ietf.org/html/rfc7617), [TLS](https://tools.ietf.org/html/rfc8446), [pbkdf2](https://tools.ietf.org/html/rfc8018))
 - simple authorization (Any URL with "private" in the path will require authentication plus optional per-directory authorized user list)

This is my take on a minimalist web host with code that
can be fully reviewed in an hour and run from
source with no dependencies ([one dependency](https://nodejs.org)).

To that end, you may notice that package.json and node_modules are
missing. There are no package, grunt, trevor, cargo, slurp, jarvis,
babel, lint, or docker files. The .git folder is the only dev tool
sub-directory.

The setup script targets [systemd](https://systemd.io/) to install this software as a persistent service but the project is otherwise system-agnostic.

## Why?
Small-scale web publishing should be simple.

Self-hosting your resume (or other simple content) should not feel like it requires a CS degree.

## Quick Start
Install Node: [https://nodejs.org/](https://nodejs.org/)

Download and extract the source code: [https://github.com/shuntress/web-core/archive/main.zip](https://github.com/shuntress/web-core/archive/main.zip)  
*(alternately, you can use [Git](https://git-scm.com/downloads) to clone the repository: `git clone https://github.com/shuntress/web-core.git`)*  

Navigate to your install location: `cd {path/on/your/system/to/web-core-main}`
*(`web-core-main` if you downloaded the archive zip file, `web-core` if you cloned the repository)*

Create your certificate: `openssl req -newkey rsa:2048 -nodes -keyout administration/key.pem -x509 -days 365 -out administration/certificate.pem`  
*You can use [openssl](https://www.openssl.org/) to generate your own certificate or get a trusted certificate from [letsencrypt](https://letsencrypt.org/getting-started/)*  
*If this step is confusing, read up on [TLS](https://en.m.wikipedia.org/wiki/Transport_Layer_Security) and [Public Key Cryptography](https://en.m.wikipedia.org/wiki/Public-key_cryptography).*  
*Admittedly, this part does kind of feel like it requires a CS degree.*

Run the site: `node src/site.js`

Add some static content:
 - `echo "test file, please ignore" > www/testfile.txt`
 - `mkdir www/private`
 - `echo "private test file" > www/private/testfile.txt`

Check the test file: [https://localhost/testfile.txt](https://localhost/testfile.txt)

Check the private test file: [https://localhost/private/testfile.txt](https://localhost/private/testfile.txt)

Check the status page: [https://localhost/status](https://localhost/status)

### Account setup
Request a new account: [https://localhost/account](https://localhost/account)

Stop the site (`CTRL+C` if it's already running) 

Approve your request by copying the contents of `administration/account_creation_requests.txt` to `administration/user_credentials.txt`. User credentials are loaded once during initialization. If `user_credentials.txt` is missing, it will be created automatically.

Restart the site: `node src/site.js`.

Check the private test file: [https://localhost/private/testfile.txt](https://localhost/private/testfile.txt)

