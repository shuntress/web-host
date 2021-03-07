/**
 * This is the 'main' module.
 * 
 * The goal is to provide simple access to everything
 * you might need out of your website.
 *
 * All the defaults should be good but you can change
 * them if you want.
 */


/**
 * import node built-ins
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

/**
 * import modules from this project
 */
const auth = require(path.join(__dirname, 'auth.js'));
const log = require(path.join(__dirname, 'log.js'));
const dispatch = require(path.join(__dirname, 'dispatch.js'));
const config = require(path.join(__dirname, 'config.js'));

/**
 * SECRET Key and PUBLIC Certificate
 *
 * These are required for https which is required to protect the
 * username:password which is expected to be transferred as a base64 encoded
 * plaintext header according to RFC7617.
 *
 * If they do not exist, try using the following command to generate them:
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
	log.info(log.tags('Request', httpsPort, req.method), JSON.stringify({from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`}));

	/**
	 * auth.js checks for valid credentials in the authentication header. It
	 * calls the provided callback if a valid user:password combination is
	 * present otherwise, it returns a 401 response.
	 */
	auth.authenticate(req, res, () => {
		dispatch(req, res);
	});
});
httpsServer.on('upgrade', (req, socket, head) => dispatch(req, null, socket, head));
httpsServer.listen(httpsPort);

/**
 * Non-secure http endpoint.
 * This just redirects to the secure endpoint.
 */
const httpPort = config.httpPort;
const httpServer = http.createServer(function (req, res) {
	let redirectLocation = "https://" + (req.headers.host ?? '') + (req.url ?? '');
	log.info(log.tags('Request', httpPort, req.method, 'Redirect'), JSON.stringify({from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`, redirectTo: redirectLocation}));
	res.writeHead(302, {'Location': redirectLocation});
	res.end();
});
httpServer.listen(httpPort);

