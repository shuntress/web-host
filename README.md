
## What is this?
 A few small Javascript modules using only node's built-ins for easy
 small-scale web hosting.

 - static (filesystem index)
 - dynamic (server-side javascript)
 - secure authentication ([HTTP authentication](https://tools.ietf.org/html/rfc7617), TLS/SSL, pbkdf2)
 - simple authorization (optional per-directory user list)

## Why?
Small-scale web publishing should be simple.

This is my take on a minimalist web host with source code that
can be fully reviewed in an hour and installed/run from
source with no dependencies ([one dependency](https://nodejs.org)).

To that end, you may notice that package.json and node_modules are
missing. There are no grunt, trevor, cargo, slurp, package, jarvis,
babel, lint, or docker files. There are no subdirectories (except git).

The included (short) setup script targets *nix & systemd (the javascript
should be all be system-agnostic) and handles the most complicated part
(systemd configuration) of installing this software.