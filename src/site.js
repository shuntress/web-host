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
const httpsRoot = path.join(__dirname, '..', 'www');
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
 * openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem
 */
const httpsOptions = {
	key: fs.readFileSync(serverPrivateKeyPath),
	cert: fs.readFileSync(serverCertificatePath)
};

/**
 * Setup the authentication module.
 * This will load user credentials from the disk
 * in to memory to be checked against the auth
 * header on secure requests.
 */
auth.init();

/**
 * This is the secure entrypoint
 */
const httpsServer = https.createServer(httpsOptions, function (req, res) {
	log(`(https ${httpsPort} secure) ${req.method} request for ${httpsPort} ${req.headers.host}${req.url} from ${req.connection.remoteAddress}`);
	req.url = path.normalize(req.url);

	/**
	 * auth.js checks for valid credentials in the authentication header.
	 * It calls the handleHttpsRequest callback if a valid user:password
	 * combination is present and returns 401 otherwise.
	 */
	auth.authorize(req, res, () => {
		if (!httpsDispatch(req, res)) {
			index(httpsRoot, pickIndexFile(req.headers.host), req, res);
		}
	});
});
const httpsDispatch = dispatch.getDispatcher(httpsControllerDir, httpsRoot, httpsServer);
httpsServer.listen(httpsPort);

/**
 * Non-secure http endpoint.
 * This just redirects to the secure endpoint.
 */
const httpServer = http.createServer(function (req, res) {
	let redirectLocation = "https://" + req.headers.host + req.url;
	log(`(http ${httpPort}) ${req.method} request for ${httpPort} ${req.headers.host}${req.url} from ${req.connection.remoteAddress} redirecting to ${redirectLocation}`);
	res.writeHead(302, {'Location': redirectLocation});
	res.end();
});
httpServer.listen(httpPort);

/**
 * Pick a specific 'index'/'default'/'landing' page
 * depending on the domain of the request.
 * 
 * I added this because I bought the domain 1-800-frogs.com
 * and I wanted to be able to display something specific to that
 * site.
 * 
 * This probably should be in the index.js module but I'll just leave
 * it here for now.
 * @param {string} domain  The domain to match
 * @param {bool} isPrivate Flag to separate http/https
 */
const pickIndexFile = (domain, isPrivate) => {
	/**
	 * // TODO: Many requests come in with domain=undefined
	 * from automatic tools. Add something here to handle that.
	 */

	if (domain && domain.includes('www.1-800-frogs.com')) {
		return 'frogs.html';
	}
	if (domain && domain.includes('www.teabagmedaddy.com')) {
		return 'mv.html';
	}

	return indexFile;
};
