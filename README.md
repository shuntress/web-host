
## What is this?
 A few small Javascript modules
using only node's built-ins to serve static
content, a basic dispatcher that routes
requests to controller modules for dynamic content,
and basic authentication to separate public and private pages.

## Why?
It should be easy to put basic content on the web.

This is my take on a minimalist
fully-featured web host with source code that
can be reviewed and understood in an hour or
two.

To that end, you may notice the node_modules folder is
missing and that there are no grunt, trevor, cargo,
slurp, package, jarvis, babel, lint, or
docker files. There are no subdirectories
(except git).

The most complex part of installing this
software is basic systemd configuration.