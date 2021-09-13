/**
 * This module manages user access.
 *
 * Public resources (default) do not require authentication.
 * Private resources (anything with "private" it its URL) are accessible only
 * to authenticated users.
 * Privacy may be specified further through authorization. Adding a file named
 * ".authorized_users" to any directory will allow access (to that directory and
 * its contents recursively) to the users specified in the .authorized_users
 * file (plaintext line break separated user names)
 *
 * Checking "private" URLs this way may lead to some false positives but I want
 * the bluntest possible way to ensure that the privacy of any given resource is
 * inherent in its identifier. Be aware that a typo ("prvirate") will "fail
 * open".
 *
 * This module also controls the "Request Account" page (
 * https://[my.website]/account ) When a user visits that URL and requests an
 * account, this module puts their account information in to the
 * "account_creation_requests.txt" file in the project administration directory
 * which must then be copied to the "user_credentials.txt" file to activate their
 * account.
 */

const fs = require('fs');
const url = require('url');
const os = require('os');
const { parse } = require('querystring');
const path = require('path');
const { randomBytes, pbkdf2 } = require('crypto');

const log = require(path.join(__dirname, 'log.js'));
const config = require(path.join(__dirname, 'config.js'));

const pathToUserCredentials = config.pathToUserCredentials;
const pathToUserAccountRequests = config.pathToUserAccountRequests;
const invalid_names = {};
const totalUsernameLimit = config.totalUsernameLimit;

/**
 * Setup handles loading user credentials from the disk in to memory to be
 * checked against the auth header on secure requests.
 */
let openAccountRequests = 0;
let users = '';
try {
	users = fs.readFileSync(pathToUserCredentials, 'utf8');
}
catch (err) {
	if (err.code == 'ENOENT') {
		// User credentials file does not exist, so we create it here.
		fs.open(pathToUserCredentials, 'w', (err) => { if (err) throw err; });
	} else {
		throw err;
	}
}

// Parse user credentials into memory
const authorized_credentials = users.split(os.EOL).filter(row => row.length > 3).map(row => {
	if (row.length > 300) log.warning(log.tag('Auth'), `Abnormally long user record. Potentially malicious user input or mistakenly missing line break. Check ${pathToUserCredentials}`);
	const parts = row.split(' ');
	return { name: parts[0], salt: parts[1], pwHash: parts[2], locked: Boolean(parts[3])};
}).reduce((acc, user) => {
	acc[user.name] = { salt: user.salt, pwHash: user.pwHash, locked: user.locked, loginAttempts: 0 };
	return acc;
}, {});

try {
	openAccountRequests = Math.max(0, fs.readFileSync(pathToUserAccountRequests, 'utf8').split(os.EOL).length - 1);
} catch (err) {
	if (err.code != 'ENOENT') {
		throw err;
	}
}

log.info(log.tag('Startup'), `Open Account Requests: ${openAccountRequests}`);

/**
 * Authenticate the user to allow access to private resources.
 *
 * This function prompts for and compares the HTTP Basic Authentication header
 * against current user credentials.
 *
 * This function also handles sending the "new account" form which allows users
 * to request an account and handles adding those requests to the pending account
 * requests.
 *
 * @param {node's request object} req  https://nodejs.org/api/http.html#http_class_http_clientrequest
 * @param {node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 * @param {function} callback          Request handler that called here to check authentication.
 */
module.exports.authenticate = function authorize(req, res, callback) {
	// Private resources (anything with "private" in its name or location)
	// are only available to authenticated users.
	if (req.url && !new url.URL(req.url, req.protocol + '://' + req.headers.host).pathname.includes("private")) {
		// If this request is not for a private resource, let it through.
		callback();
		return;
	} else {
		validateCredentials(req, res, callback);
	}
};

/**
 * Check for authorization file. Scan up the tree from the requested resource to the root.
 * In the first auth file found, check if the current user is on the list of authorized users
 * for the requested resource. If no auth file is found, default to open.
 *
 * @param {Node's request object} req  https://nodejs.org/api/http.html#http_class_http_clientrequest
 * @param {Node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 * @param {string} root                The absolute path to the site's base folder.
 * @param {string} checkPath           An absolute path somewhere between the root and the requested resource.
 * @param {function} callback          Request handler that called here to check authorization.
 */
 module.exports.authorize = function checkAuthorization(req, res, root, checkPath, callback) {
	fs.readFile(path.join(checkPath, ".authorized_users"), (err, data) => {
		if (err) {
			if (err.code == 'ENOENT') {
				// Recurse up the tree looking for the closest .authorized_users file
				if (path.relative(checkPath, root) === path.basename(root)) {
					// At the root, no auth file found. Default to open.
					callback();
				} else {
					checkAuthorization(req, res, root, path.dirname(checkPath), callback);
				}
				return;
			}
			log.error(log.tags('Auth'), `Authorization Failure: ${err}`);
		}

		if (!config.useHttps) {
			log.error(log.tags('Auth', 'Abort'), `Authorization configured without HTTPS. HTTPS is required for secure password transfer. Please configure HTTPS certificates and enable HTTPS in administration/config.json`);
			res.writeHead(500);
			res.end("Internal Error");
			return;
		}

		// Make sure the user is logged in.
		validateCredentials(req, res, () => {
			// Check whether the logged in user is on the list of authorized users for this resource.
			const name = getUserName(req);
			if (data.toString().split(os.EOL).includes(name)) {
				callback();
			} else {
				res.writeHead(403, { "Content-Type": "text/plain" });
				res.end("Access Forbidden");
				log.warning(log.tags('Auth'), `unauthorized access attempt by ${name} to ${checkPath}`);
			}
		});
	});
}

module.exports.currentUser = getUserName;

/**
 * Handle sending/receiving the new account request form.
 */
module.exports.sendAccountForm = (req, res) => {
	if (!config.useHttps) {
		res.writeHead(400);
		res.end("Account creation requires HTTPS connection.");
		return;
	}

	if (req.method == "GET") {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(`
<html>
	<body>
		<form method="POST" action="/account">
			<label for="username">Username:</label>
			<input name="username" type="text" />
			<label for="password">password</label>
			<input name="password" type="password" />
			<input type="submit" value="Request Account" />
		</form>
	</body>
</html>
`);
	}

	else if (req.method == "POST") {
		let body = [];
		req.on('data', (chunk) => {
			body.push(chunk);
		}).on('end', () => {
			body = parse(Buffer.concat(body).toString());
			// at this point, `body` has the entire request body stored in it as a string
			if (/[^A-z^0-9]/.test(body.username) || body.username.length > 64) {
				// Username Validation failed
				log.warning(log.tag('Auth'), `Invalid username request ${JSON.stringify(body.username)}`);
				res.writeHead(400);
				res.end('Invalid Username');
				return;
			}

			const username = path.normalize(body.username);
			const password = path.normalize(body.password);
			const salt = randomBytes(64).toString('base64');

			if (openAccountRequests > 100) {
				log.warning(log.tag('Auth'), `Too many open account requests`);
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Too many open account requests.');
			} else {
				getPasswordHash(salt, password, (err, pwHash) => {

					if (err) {
						log.error(log.tag('Auth'), err);
						res.writeHead(500);
						res.end();
						return;
					}

					const userRecord = `${username} ${salt} ${pwHash.toString('base64')}`;
					log.info(log.tag('Auth'), `New account request (${username})`);
					fs.appendFile(pathToUserAccountRequests, userRecord + os.EOL, function (err) {
						if (err) throw err;
						openAccountRequests++;
						res.writeHead(200, { 'Content-Type': 'text/plain' });
						res.end('Account requested.');
					});
				});
			}
		});
	}
}

/**
 * Checks the username and password on the request headers.
 * If the hash of the provided password matches the hash on file for that
 * username, the callback is executed. Otherwise, a "Permission denied" request
 * for login response is sent.
 *
 * @param {node's request object} req  https://nodejs.org/api/http.html#http_class_http_clientrequest
 * @param {node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 * @param {function} callback
 */
function validateCredentials(req, res, callback) {
	const auth = req.headers.authorization;
	const parts = auth && auth.split(' ');
	const credentials = parts && parts.length > 1 && Buffer.from(parts[1], 'base64').toString('ascii').split(':');

	if (!credentials) {
		log.info(log.tag('Auth'), 'Unauthorized: credentials not provided');
		sendLoginPrompt(res);
		return;
	}

	if (authorized_credentials[credentials[0]] == null && invalid_names[credentials[0]] == null) {
		// If the provided credentials are not on the list of authorized users or
		// the list of invalid names, then add them to the list of invalid names.
		// This allows and invalid account login attempt to be treated (and
		// locked) the same as a regular login attempt with the same logic.

		if (Object.keys(authorized_credentials).length + Object.keys(invalid_names).length > totalUsernameLimit) {
			// This check just limits the number of tracked invalid account names.
			log.warning(log.tags('Auth'), 'Too many invalid account login attempts');
			res.writeHead(500);
			stallSend("Internal Error", res);
			return;
		}

		invalid_names[credentials[0]] = {
			salt: ' no salt ',
			pwHash: ' no password hash ',
			loginAttempts: 0,
			locked: false,
		};
	}

	const username = credentials && credentials[0];
	const password = credentials && credentials[1];
	const salt = authorized_credentials[username]?.salt ?? '';

	getPasswordHash(salt, password, (err, pwHash) => {
		if (err) {
			log.error(log.tag('Auth'), err);
			res.writeHead(500);
			res.end();
			return;
		}
		let user = authorized_credentials[username] ?? invalid_names[username];
		if (user.pwHash.trim() == pwHash.toString('base64') && !user.locked) {
			callback();
		} else {
			user.loginAttempts++;
			log.warning(log.tag('Auth'), `Unauthorized: Wrong Password. Username: ${username} attempt #${user.loginAttempts}`);
			if (user.loginAttempts > 3) {
				log.warning(log.tag('Auth'), `Account Locked (${username}). Too many failed login attempts.`);
				user.locked = true;
			}
			sendLoginPrompt(res);
		}
	});
}

function sendLoginPrompt(res) {
	res.setHeader('WWW-Authenticate', 'Basic realm="log in please"');
	res.writeHead(401);
	res.end("Access Denied");
}

function getPasswordHash(salt, password, callback) {
	pbkdf2(password, salt, 10000, 64, 'sha512', callback);
}

/**
 * Get current user name from auth headers.
 *
 * @param {Node's request object} req https://nodejs.org/api/http.html#http_class_http_clientrequest
 *
 * @return {string?} User name
 */
function getUserName (req) {
	const auth = req.headers.authorization;
	const parts = auth && auth.split(' ');
	const credentials = parts && parts.length > 1 && Buffer.from(parts[1], 'base64').toString('ascii').split(':');
	return credentials && credentials[0];
}

/**
 * Sends the given message one character at a time with a 1-5 second delay
 * between each character.
 *
 * @param {string} message
 * @param {Node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 */
function stallSend(message, res) {
	if (message.length > 0) {
		res.write(message[0]);
		setTimeout(() => stallSend(message.substring(1), res), Math.floor(Math.random() * (5000)) + 1000)
	} else {
		res.end();
	}
}
