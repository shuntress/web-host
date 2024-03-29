/**
 * This module handles interfacing with custom server-side code
 * by matching the given URL against the list of a plugin actions.
 * 
 * By default, these modules are found in the "plugins" directory.
 */


const fs = require('fs');
const path = require('path');
const url = require('url');

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
module.exports = (req, res, socket, head) => {
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
	}

	if (parts.length > 1) {
		const action = parts.pop();
		const plugin = parts.pop();
		const pluginPath = path.join(...parts);

		const find = path.join(pluginRoot, pluginPath, plugin + '.js');

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

/**
 * Scan the pluginRoot for plugin modules. Each detected
 * plugin will be imported (require('found_plugin')) and 
 * have its `init` function called. The init function is passed
 * the wwwRoot so that a the plugin may access static data
 * 
 * @param {string} dir Current scan directory
 */
const scan = (dir) => {
	// load dir 
	const nodes = fs.readdirSync(dir);

	// Check each file, if its a directory append to dir and pass to scan
	nodes.forEach(node => {
		const pluginPath = path.join(dir, node);
		const stats = fs.lstatSync(pluginPath);
		if (stats.isFile() && path.extname(pluginPath) == ".js") {
						// If its a file append to plugins
			let plugin = require(pluginPath);
			plugins[pluginPath] = plugin;
			if (plugin.init) {
				plugin.init({
					wwwRoot,
					auth,
					log,
					config,
					getResource: (req, res, resourceName) => index(req, res, pluginRoot, "", path.join(path.dirname(pluginPath), path.basename(pluginPath, '.js'), 'resources', resourceName))
				});
			}
		} else if (
			stats.isDirectory()
			&& !pluginPath.includes('node_modules')
			&& node != 'data'
			&& node != 'resources'
		) {
			/**
			 * TODO: Hack fix to ignore node modules and app data.
			 * Flesh this out... better... or something.
			 */
			scan(pluginPath);
		}
	});
};
const plugins = {}; // All modules found by scanning the plugin directory. Key'd on path
scan(pluginRoot);
log.info(log.tags('Startup'), `found ${Object.keys(plugins).length} plugin${Object.keys(plugins).length > 1 ? 's' : ''}`);

