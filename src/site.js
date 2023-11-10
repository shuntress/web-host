/**
 * This is the 'main' module.
 * 
 * The goal is to provide simple access to everything
 * you might need out of your website.
 *
 * All the defaults should be good but easy to change.
 */

/**
 * import node built-ins
 */
const path = require('path');
const fs = require('fs');
const tls = require('tls');
const https = require('https');
const http = require('http');

/**
 * import modules from this project
 */
const auth = require(path.join(__dirname, 'auth.js'));
const log = require(path.join(__dirname, 'log.js'));
const dispatch = require(path.join(__dirname, 'route.js')).dispatch;
const config = require(path.join(__dirname, 'config.js'));
const tests = require(path.join(__dirname, 'tests.js'));

tests();
if (tests.fail) {
	log.error("Test Failure.")
	process.exit(1);
}

/**
 * Basic http endpoint.
 * 
 * If https is enabled, this just redirects to the secure endpoint.
 */
const httpPort = config.httpPort;
const httpServer = http.createServer(function (req, res) {
	if (config.useHttps) {
		let redirectLocation = "https://" + (req.headers.host ?? '') + (req.url ?? '');
		let logData = JSON.stringify({port: httpPort, method: req.method, user: auth.currentUser(req), from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`, redirectTo: redirectLocation});
		log.info(log.tags(log.ansi(auth.currentUser(req), log.ansi.magenta, log.ansi.bold), 'Request', log.ansi(decodeURIComponent(path.basename(req.url)), log.ansi.blue), log.ansi('Redirect', log.ansi.green)), decodeURIComponent(req.url), log.ansi(logData, log.ansi.conceal));
		res.writeHead(302, {'Location': redirectLocation});
		res.end();
	} else {
		let logData = JSON.stringify({port: httpPort, method: req.method, user: auth.currentUser(req), from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`});
		log.info(log.tags(log.ansi(auth.currentUser(req), log.ansi.magenta, log.ansi.bold), 'Request', log.ansi(decodeURIComponent(path.basename(req.url)), log.ansi.blue)), decodeURIComponent(req.url), log.ansi(logData, log.ansi.conceal));

		/** auth.js will abort requests for protected resources because
		 *   HTTPS is required in order to securely transfer credentials.
		 **/
		auth.authenticate(req, res, () => {
			dispatch(req, res);
		});
	}
});
httpServer.listen(httpPort);

/**
 * To make the basic setup as simple as possible (by avoiding dealing with
 * certificates,) this is optional but to transfer passwords securely (for login)
 * you **must** use https.
 */
if (config.useHttps) {
	/**
	 * SECRET Key and PUBLIC Certificate
	 *
	 * These are required for HTTPS which is required to protect the
	 * username:password which is expected to be transferred as a base64 encoded
	 * plaintext header according to RFC7617.
	 *
	 * You can get trusted certificates from somewhere like https://letsencrypt.org/ or use the following command to generate them:
	 *
	 * openssl req -newkey rsa:2048 -nodes -keyout administration/key.pem -x509 -days 365 -out administration/certificate.pem
	 */
	const httpsOptions = {
		key: fs.readFileSync(config.serverPrivateKeyPath),
		cert: fs.readFileSync(config.serverCertificatePath)
	};

	/**
	 * This is the secure entrypoint
	 */
	const httpsPort = config.httpsPort;
	const httpsServer = https.createServer(httpsOptions, function (req, res) {
		let logData = JSON.stringify({port: httpsPort, method: req.method, user: auth.currentUser(req) ?? "no user info", from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`});
		log.info(log.tags(log.ansi(auth.currentUser(req), log.ansi.magenta, log.ansi.bold), 'Request', log.ansi(decodeURIComponent(path.basename(req.url)), log.ansi.blue)), decodeURIComponent(req.url), log.ansi(logData, log.ansi.conceal));

		/**
		 * auth.js checks for valid credentials in the authentication header. It
		 * calls the provided callback if a valid user:password combination is
		 * present otherwise, it returns a 401 response.
		 */
		auth.authenticate(req, res, () => {
			dispatch(req, res);
		});
	});
	httpsServer.on(log.ansi('Upgrade', log.ansi.green), (req, socket, head) => dispatch(req, null, socket, head));
	httpsServer.listen(httpsPort);
}

