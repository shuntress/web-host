/**
 * This module handles interfacing with custom server-side code
 * by matching the given URL against the list of a controller actions.
 * 
 * By default, these modules are found in the "controllers" directory.
 */


const fs = require('fs');
const path = require('path');
const url = require('url');

const auth = require(path.join(__dirname, 'auth.js'));
const log = require(path.join(__dirname, 'log.js'));
const index = require(path.join(__dirname, 'index.js'));
const config = require(path.join(__dirname, 'config.js'));

const wwwRoot = config.wwwRoot;
const controllerRoot = config.controllerRoot;

/**
 * This functions checks the list of controllers for one that
 * has a path matching the URL then calls a function on that
 * controller that matches the last part of the URL path
 * 
 * It also parses the query string on the URL and passes that
 * to the action function as a plain object.
 * 
 * Return true if a controller action was called.
 * @param {Node's request object} req  https://nodejs.org/api/http.html#http_class_http_clientrequest
 * @param {Node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 */
module.exports = (req, res, socket, head) => {
	// parse url to determine controller/action
	const parsedUrl = new url.URL(req.url, req.protocol + '://' + req.headers.host);
	const parts = parsedUrl.pathname.split('/').filter(p => p);

	// Socket Upgrade Request
	if (socket && head) {
		const controller = parts.pop();
		const controllerPath = path.join(...parts);

		const find = path.join(controllerRoot, controllerPath, controller + '.js');

		let match = controllers[find];

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
		const controller = parts.pop();
		const controllerPath = path.join(...parts);

		const find = path.join(controllerRoot, controllerPath, controller + '.js');

		/**
		 * TODO: Fix this
		 * If someone tries to run the init action, just abort.
		 * Maybe figure out a better fix for this that allows controllers
		 * to have a real action called init and correctly hides the framework
		 * init from access.
		 */
		if (action == 'init') return false;

		// check for controller in controller collection
		if (action && controller && controllerPath) {
			if (controllers[find]) {
				if (controllers[find][action]) {
					const query = Array.from(parsedUrl.searchParams.keys()).reduce((a, k) => { return Object.assign({ [k]: parsedUrl.searchParams.get(k) }, a); }, {});
					log.info(log.tags('Routing'), `dispatching request for ${action} on ${controller} in ${controllerPath} with ${JSON.stringify(query)}`);
					controllers[find][action](req, res, query);
					return;
				}
			}
		}
	}

	// No controller matches route. Instead, index the directory under content/ specified by the URL path.
	index(req, res);
}

/**
 * Scan the controllerRoot for controller modules. Each detected
 * controller will be imported (require('found_controller')) and 
 * have its `init` function called. The init function is passed
 * the wwwRoot so that a the controller may access static data
 * 
 * @param {string} dir Current scan directory
 */
const scan = (dir) => {
	// load dir 
	const nodes = fs.readdirSync(dir);

	// Check each file, if its a directory append to dir and pass to scan
	nodes.forEach(node => {
		const controllerPath = path.join(dir, node);
		const stats = fs.lstatSync(controllerPath);
		if (stats.isFile() && path.extname(controllerPath) == ".js") {
						// If its a file append to controllers
			let controller = require(controllerPath);
			controllers[controllerPath] = controller;
			if (controller.init) {
				controller.init(wwwRoot, {auth, log, config});
			}
		} else if (
			stats.isDirectory()
			&& !controllerPath.includes('node_modules')
			&& node != 'data'
		) {
			/**
			 * TODO: Hack fix to ignore node modules and app data.
			 * Flesh this out... better... or something.
			 */
			scan(controllerPath);
		}
	});
};
const controllers = {}; // All modules found by scanning the controller directory. Key'd on path
scan(controllerRoot);
log.info(log.tags('Startup'), `found ${Object.keys(controllers).length} controller${Object.keys(controllers).length > 1 ? 's' : ''}`);

