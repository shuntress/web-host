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
const index = require(path.join(__dirname, 'index.js'));
const auth = require(path.join(__dirname, 'auth.js'));
const log = require(path.join(__dirname, 'log.js'));
const dispatch = require(path.join(__dirname, 'dispatch.js'));

/**
 * HTTP configuration
 */
const httpPort = 80;

/**
 * HTTPS configuration
 */
const indexFile = 'index.html';
const httpsPort = 443;
const wwwRoot = path.join(__dirname, '..', 'www');
const httpsControllerDir = path.join(__dirname, '..', 'controllers');
const serverPrivateKeyPath = path.join(__dirname, '..', 'administration', 'key.pem');
const serverCertificatePath = path.join(__dirname, '..', 'administration', 'certificate.pem');

/**
 * SECRET Key and PUBLIC Certificate
 *
 * !! KEEP THE KEY SECRET !!
 *
 * These are required for https which is required to protect the
 * username:password which is expected to be transfered as base64
 * encoded plaintext according to the RFC2617 specification.
 *
 * If they do not exist, try using the following command to generate them:
 *
 * openssl req -newkey rsa:2048 -nodes -keyout administration/key.pem -x509 -days 365 -out administration/certificate.pem
 */
const httpsOptions = {
	key: fs.readFileSync(serverPrivateKeyPath),
	cert: fs.readFileSync(serverCertificatePath)
};

/**
 * This is the secure entrypoint
 */
const httpsServer = https.createServer(httpsOptions, function (req, res) {
	log.info(log.tags('Request', httpsPort, req.method), JSON.stringify({from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`}));
	req.url = path.normalize(req.url ?? '');

	/**
	 * auth.js checks for valid credentials in the authentication header.
	 * It calls the handleHttpsRequest callback if a valid user:password
	 * combination is present and returns 401 otherwise.
	 */
	auth.authenticate(req, res, () => {
		if (req.url == path.normalize('/private/status')) {
			log.sendStatusPage(req, res);
			return;
		}
		if (!httpsDispatch(req, res)) {
			index(wwwRoot, req, res);
		}
	});
});
const httpsDispatch = dispatch.getDispatcher(httpsControllerDir, wwwRoot, httpsServer);
httpsServer.listen(httpsPort);

/**
 * Non-secure http endpoint.
 * This just redirects to the secure endpoint.
 */
const httpServer = http.createServer(function (req, res) {
	let redirectLocation = "https://" + (req.headers.host ?? '') + (req.url ?? '');
	log.info(log.tags('Request', httpPort, req.method, 'Redirect'), JSON.stringify({from: req.socket.remoteAddress, for: `${req.headers.host}${req.url}`, redirectTo: redirectLocation}));
	res.writeHead(302, {'Location': redirectLocation});
	res.end();
});
httpServer.listen(httpPort);

