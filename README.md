
## What is this?
This is my take on a minimalist web host with code that
can be fully reviewed in an hour and installed/run from
source with no dependencies ([one dependency](https://nodejs.org)).

This small web host uses only node's built-ins to handle:
 - static content (filesystem index)
 - dynamic content (server-side javascript)
 - secure authentication ([HTTP authentication](https://tools.ietf.org/html/rfc7617), [TLS](https://tools.ietf.org/html/rfc8446), [pbkdf2](https://tools.ietf.org/html/rfc8018))
 - simple authorization (Any URL with "private" in the path will require authentication plus optional per-directory authorized user list)

## Why?
Small-scale web publishing should be simple.

To that end, you may notice that package.json and node_modules are
missing. There are no package, grunt, trevor, cargo, slurp, jarvis,
babel, lint, or docker files. The .git folder is the only dev tool
sub-directory.

The setup script targets [systemd](https://systemd.io/) to install this software as a persistent service but the project is otherwise system-agnostic.

## Quick Start

Install Git: [https://git-scm.com/downloads](https://git-scm.com/downloads)

Install Node: [https://nodejs.org/](https://nodejs.org/)

Clone the repository: `git clone https://github.com/shuntress/web-core.git`

Create your certificate: `openssl req -newkey rsa:2048 -nodes -keyout web-core/administration/key.pem -x509 -days 365 -out web-core/administration/certificate.pem`  
If this step is confusing, read up on [TLS](https://en.m.wikipedia.org/wiki/Transport_Layer_Security) and [Public Key Cryptography](https://en.m.wikipedia.org/wiki/Public-key_cryptography).

Run the site: `node web-core/src/site.js`

Add some static content:
 - `echo "test file, please ignore" > web-core/www/testfile.txt`
 - `mkdir web-core/www/private`
 - `echo "private test file" > web-core/www/private/testfile.txt`

Check the test file: [https://localhost/testfile.txt](https://localhost/testfile.txt)

Check the private test file: [https://localhost/private/testfile.txt](https://localhost/private/testfile.txt)

### Account setup
Request a new account: [https://localhost/account](https://localhost/account)

Stop the site (`CTRL+C` if it's already running) 

Approve your request by copying the contents of `web-core/administration/account_creation_requests.txt` to `web-core/administration/user_credentials.txt`. User credentials are loaded once during initialization. If `user_credentials.txt` is missing, it will be created automatically.

Restart the site: `node web-core/src/site.js`.

Check the private test file: [https://localhost/private/testfile.txt](https://localhost/private/testfile.txt)

