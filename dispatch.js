/**
 * This module handles interfacing with custom server-side code
 * 
 * `site.js` calls `getDispatcher` to get back a function that
 * checks a given URL to see if a controller action exists to
 * handle that URL.
 * 
 * controllerRoot and wwwRoot exist to prevent exposing controller
 * code directly as a static file.
 * 
 * Be default,
 * for http they will be: www-actions-public and www-public
 * for https they will be: www-actions-private and www-private
 */


const fs = require('fs');
const path = require('path');
const url = require('url');

const log = require(path.join(__dirname, 'log.js'));

/**
 * Scan root for controllers
 * Map controllers (key'd by path)
 * Each exported action will be a property
 * 
 * Return dispatcher function.
 * @param {string} controllerRoot www-actions-public or www-actions-private)
 * @param {string} wwwRoot        The corresponding path to static data (in www-public|private)
 * @param {object} server         The node http(s) server endpoint intended to be wrapped in a WebSocket endpoint
 */
module.exports.getDispatcher = (controllerRoot, wwwRoot, server) => {
	const controllers = {};
	scan(controllerRoot, controllers, wwwRoot, server);
	return (req, res) => {
		return dispatch(req, res, controllers, controllerRoot);
	};
}

/**
 * This functions checks the list of controllers for one that
 * has a path matching the URL then calls a function on that
 * controller that matches the last part of the URL path
 * 
 * It also parses the query string on the URL and passes that
 * to the action function as a plain object.
 * 
 * Return true if a controller action was called.
 * @param {*} req            Request object
 * @param {*} res            Response object
 * @param {*} controllers    All controller
 * @param {*} controllerRoot (by default) www-actions-public or www-actions-private
 */
const dispatch = (req, res, controllers, controllerRoot) => {
	// parse url to determine controller/action
	const parsedUrl = new url.URL(req.url, req.protocol + '://' + req.headers.host);
	const parts = parsedUrl.pathname.split(path.sep);
	let match = false;

	if (parts.length > 1) {
		
		const action = parts.pop();
		const controller = parts.pop();
		const controllerPath = path.join(...parts);
		
		const find = path.join(controllerRoot, controllerPath, controller + '.js');

		/**
		 * TODO: Fix this
		 * If someone tries to run the init action just abort.
		 * Maybe figure out a better fix for this that allows controllers
		 * to have a real action called init and correctly hides the framework
		 * init from access.
		 */
		if (action == 'init') return false;

		// check for controller in controller collection
		if(action && controller && controllerPath) {
			if(controllers[find]) {
				if(controllers[find][action]) {
					const query = Array.from(parsedUrl.searchParams.keys()).reduce((a, k) => {return Object.assign({[k]: parsedUrl.searchParams.get(k)}, a);}, {});
					log(`dispatching request for ${action} on ${controller} in ${controllerPath} with ${JSON.stringify(query)}`);
					controllers[find][action](req, res, query);
					match=true;
				}
			}
		}
	}  
  return match;
}

/**
 * Scan the controllerRoot for controller modules. Each detected
 * controller will be imported (require('found_controller')) and 
 * have its `init` function called. The init function is passed
 * the wwwRoot so that a the controller may access static data
 * 
 * // TODO: Update this to be more selective (maybe ignore a 'data'
 * folder) to give controllers a place to put server-side-only data
 * 
 * @param {string} dir         Current scanning directory
 * @param {object} controllers All found controllers, key'd on path
 * @param {string} wwwRoot     Corresponding static data root (by default, www-public or www-private)
 * @param {object} server      The node http(s) server endpoint intended to be wrapped in a WebSocket endpoint
 */
const scan = (dir, controllers, wwwRoot, server) => {
	// load dir 
	const nodes = fs.readdirSync(dir);

	// Check each file, if its a directory appaend to dir and pass to scan
	nodes.forEach(node => {
		const controllerPath = path.join(dir, node);
		const stats = fs.lstatSync(controllerPath);
		if (stats.isFile()) {
			log(`found controller ${controllerPath}`);
			// If its a file append to controllers
			let controller = require(controllerPath);
			if (controller.init) {
				controller.init(wwwRoot, server);
			}
				controllers[controllerPath] = controller;
		} else if (
			stats.isDirectory()
			&& !controllerPath.includes('node_modules')
			&& node != 'data'
		) {
			/**
			 * TODO: Hack fix to ignore node modules and app data.
			 * Flesh this out... better... or something.
			 */
			scan(controllerPath, controllers, wwwRoot, server);
		}
	});
};
