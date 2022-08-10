/**
 * This module handles interfacing with custom server-side code
 * by matching the given URL against the list of a plugin actions.
 * 
 * By default, these modules are found in the "plugins" directory.
 */


const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');
const { runInNewContext } = require('vm');

const auth = require(path.join(__dirname, 'auth.js'));
const log = require(path.join(__dirname, 'log.js'));
const index = require(path.join(__dirname, 'index.js'));
const config = require(path.join(__dirname, 'config.js'));

const wwwRoot = config.wwwRoot;
const pluginRoot = config.pluginRoot;

/**
 * This functions checks the list of plugins for one that
 * has a path matching the URL then calls a function on that
 * plugin that matches the last part of the URL path
 * 
 * It also parses the query string on the URL and passes that
 * to the action function as a plain object.
 * 
 * Return true if a plugin action was called.
 * @param {Node's request object} req  https://nodejs.org/api/http.html#http_class_http_clientrequest
 * @param {Node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 */
module.exports.dispatch = (req, res, socket, head) => {
	// parse url to determine plugin/action
	const parsedUrl = new url.URL(req.url, req.protocol + '://' + req.headers.host);
	const parts = parsedUrl.pathname.split('/').filter(p => p);

	// Socket Upgrade Request
	if (socket && head) {
		const plugin = parts.pop();
		const pluginPath = path.join(...parts);

		const find = path.join(pluginRoot, pluginPath, plugin + '.js');

		let match = plugins[find];

		if (match && match.webSocket) {
			match.webSocket.handleUpgrade(req, socket, head, (ws) => {
				match.webSocket.emit('connection', ws, req);
			});
		}
		return;
	}

	// "Special Case" route handlers. Splitting and re-joining the path cleanly trims the trailing slash (if it exists)
	switch(parts.join('/')) {
		case config.useHttps ? 'private/status' : 'status':
			// The log module handles parsing the daily log to generate a status page
			log.sendStatusPage(req, res);
			return;
		case 'account':
			// The auth module handles account creation
			auth.sendAccountForm(req, res);
			return;
		case 'map':
			res.writeHead(302, {location: "/map.html"});
			res.end();
			return;
	}

	if (parts.length > 1) {
		const action = parts.pop();
		const plugin = parts.pop();
		const pluginPath = path.join(...parts);

		const find = path.join(pluginRoot, pluginPath, plugin);

		/**
		 * TODO: Fix this
		 * If someone tries to run the init action, just abort.
		 * Maybe figure out a better fix for this that allows plugins
		 * to have a real action called init and correctly hides the framework
		 * init from access.
		 */
		if (action == 'init') return false;

		// check for plugin in plugin collection
		if (action && plugin && pluginPath) {
			if (plugins[find]) {
				if (plugins[find][action]) {
					const query = Array.from(parsedUrl.searchParams.keys()).reduce((a, k) => { return Object.assign({ [k]: parsedUrl.searchParams.get(k) }, a); }, {});
					log.info(log.tags('Routing'), `dispatching request for ${action} on ${plugin} in ${pluginPath} with ${JSON.stringify(query)}`);
					plugins[find][action](req, res, query);
					return;
				}
			}
		}
	}

	// No plugin matches route. Instead, index the directory under content/ specified by the URL path.
	const webPath = path.normalize(decodeURIComponent(url.parse(req.url).pathname));
	const absoluteSystemPath = path.join(wwwRoot, webPath);
	index(req, res, wwwRoot, webPath, absoluteSystemPath);
}

module.exports.sendNotFound = (req, res) => {
	// If this request would 404, but we have any clustered nodes,
	// Check to see if another server has this resource
	if (config.clusterNodes?.length > 0) {
		config.clusterNodes.forEach(node =>{
			log.info(`Checking ${node} for ${req.url}`)
			const options = {
				hostname: node,
				port: req.socket.localPort,
				path: req.url,
				method: req.method,
				header: req.headers,
			}

			const probe = https.request(options, probeRes => {
				console.log(JSON.stringify({status: probeRes.statusCode, headers: probeRes.headers}), null, 2);

				res.writeHead(probeRes.statusCode, probeRes.headers);
				probeRes.on('data', d => {
					res.write(d)
				})

				probeRes.on('end', d => {
					res.end(d)
				})

			})

			probe.on('error', error => {
				log.error(error)
			})

			probe.end()
		});

	} else {
		res.writeHead(404);
		res.end("404 Not Found");
	}
}

/**
 * Scan the pluginRoot for plugin modules. Each detected
 * plugin will be imported (require('found_plugin')) and 
 * have its `init` function called. The init function is passed
 * the wwwRoot so that a the plugin may access static data
 * 
 * @param {string} dir Current scan directory
 */
const scan = (dir) => {
	// load directory
	const nodes = fs.readdirSync(dir);

	// If this directory contains a file named "plugin.js", then this directory is a plugin
	//   and should be added to the list.

	// TODO: Fix what happens when plugin.js is found in the plugin root.
	if(nodes.some(node => path.basename(node) === "plugin.js")) {
		const pluginPath = path.join(dir, "plugin.js");
		let plugin = require(pluginPath);
		plugins[dir] = plugin;
		if (plugin.init) {
			plugin.init({
				wwwRoot,
				auth,
				log,
				config,
				getResource: (req, res, resourceName) => index(req, res, dir, path.join('resources', resourceName), path.join(dir, 'resources', resourceName))
			});
		}
	} else {
		// Check each file, if its a directory append to dir and pass to scan
		nodes.forEach(node => {
			const nextPath = path.join(dir, node);
			const stats = fs.lstatSync(nextPath);
			if (
				stats.isDirectory()
				&& node != 'node_modules'
				&& node != 'data'
				&& node != 'resources'
			) {
				/**
				 * TODO: Hack fix to ignore node modules and app data.
				 * Flesh this out... better... or something.
				 */
				scan(nextPath);
			}
		});
	}
};

const plugins = {}; // All modules found by scanning the plugin directory. Key'd on path
scan(pluginRoot);
log.info(log.tags('Startup'), `found ${Object.keys(plugins).length} plugin${Object.keys(plugins).length > 1 ? 's' : ''}`);
