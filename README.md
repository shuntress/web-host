
## What is this?
This is my take on a minimalist web host with code that
can be fully reviewed in an hour and installed/run from
source with no dependencies ([one dependency](https://nodejs.org)).

This small web host uses only node's built-ins to handle:
 - static content (filesystem index)
 - dynamic content (server-side javascript)
 - secure authentication ([HTTP authentication](https://tools.ietf.org/html/rfc7617), TLS/SSL, pbkdf2)
 - simple authorization (optional per-directory user list)

## Why?
Small-scale web publishing should be simple.

To that end, you may notice that package.json and node_modules are
missing. There are no grunt, trevor, cargo, slurp, package, jarvis,
babel, lint, or docker files. The .git folder is the only dev tool
sub-directory.

The included (short) setup script (which targets *nix systemd, though the code
is all system-agnostic) handles installing this software as a persistent
service.
