/**
 * This module handles user access control
 *
 * It checks if a user has an authorized account when
 * they access any resource with "private" in the URL.
 * Yes, I know this may lead to some false positives
 * but I want the bluntest possible way to ensure that
 * if you make an album called "private" that it will
 * actually be covered. Be aware that in the event of a
 * typo ("prvirate") this will fail open. The tradeoff
 * is that there should be no way to force or trick a
 * private resource to load without authentication by
 * cleverly manipulating the URL.
 *
 * This module also controls the "Request Account" page
 * ( https://[my.website]/account )
 * When a user visits that URL and requests an account,
 * this module puts their account information in to the
 * "account_creation_requests.txt" file in the web-core
 * directory which must then be copied to the
 * "user_credentials.txt" file to activate their account.
 */

const fs = require('fs');
const url = require('url');
const { parse } = require('querystring');
const path = require('path');
const { randomBytes, pbkdf2 } = require('crypto');
const log = require(path.join(__dirname, 'log.js'));

const pathToUserCredentials = path.join(__dirname, '..', 'administration', 'user_credentials.txt');
const pathToUserAccountRequests = path.join(__dirname, '..', 'administration', 'account_creation_requests.txt');


/**
 * Setup handles loading user credentials from
 * the disk in to memory to be checked against
 * the auth header on secure requests.
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

// Parse user credentials
const authorized_credentials = users.replace('\r', '').split('\n').filter(row => row.length > 3).map(row => {
	if (row.length > 300) log(`[Warning] Abnormally long user record. Potentially malicious user input or mistakenly missing line break. Check ${pathToUserCredentials}`);
	const parts = row.split(' ');
	return { name: parts[0], salt: parts[1], pwHash: parts[2] };
}).reduce((acc, user) => {
	acc[user.name] = { salt: user.salt, pwHash: user.pwHash };
	return acc;
}, {});

try {
	openAccountRequests = Math.max(0, fs.readFileSync(pathToUserAccountRequests, 'utf8').split('\n').length - 1);
} catch (err) {
	if (err.code != 'ENOENT') {
		throw err;
	}
}

log(`[Info] Open Account Requests: ${openAccountRequests}`);

/**
 * This middleware fuction authenticates the user to allow access to
 * private resources.
 *
 * @param {node's request object} req 
 * @param {node's response object} res 
 * @param {function} callback 
 */
module.exports.authenticate = function authorize(req, res, callback) {
	// Check if the user is loading the account request form
	const parsedUrl = url.parse(req.url);
	const urlparts = parsedUrl.pathname.split('/').filter(part => part != '');
	if (urlparts.length == 1 && urlparts[0] == 'account') {
		sendAccountForm(req, res);
		return;
	}

	// Private resources (anything with "private" in its name or location)
	// are only available to authenticated users.
	if (req.url && !req.url.includes("private")) {
		// If this request is not for a private resource, let it through.
		callback();
		return;
	}

	const auth = req.headers.authorization;
	const parts = auth && auth.split(' ');
	const credentials = parts && parts.length > 1 && Buffer.from(parts[1], 'base64').toString('ascii').split(':');

	if (!credentials || authorized_credentials[credentials[0]] == null) {
		log('Unauthorized: credentials not provided');
		sendLoginPrompt(res);
		return;
	}
	const username = credentials && credentials[0];
	const password = credentials && credentials[1];
	const salt = authorized_credentials[username].salt;

	getPasswordHash(salt, password, (err, pwHash) => {
		if (authorized_credentials[username].pwHash == pwHash.toString('base64')) {
			callback();
		} else {
			log(`[Info] Unauthorized: Wrong Password. Username: ${username}`);
			sendLoginPrompt(res);
		}
	});
};

function sendLoginPrompt(res) {
	res.setHeader('WWW-Authenticate', 'Basic realm="log in please"');
	res.writeHead(401);
	res.end("Access Denied");
}

function sendAccountForm(req, res) {
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
				log(`[Warning] Invalid username request ${JSON.stringify(body.username)}`);
				res.writeHead(400);
				res.end('Invalid Username');
				return;
			}

			const username = path.normalize(body.username);
			const password = path.normalize(body.password);
			const salt = randomBytes(64).toString('base64');

			if(openAccountRequests > 100) {
				log(`[Warning] Too many open account requests`);
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Too many open account requests.');
			} else {
				getPasswordHash(salt, password, (err, pwHash) => {

					if (err) {
						log(err);
						res.writeHead(500);
						res.end();
						return;
					}

					const userRecord = `${username} ${salt} ${pwHash.toString('base64')}`;
					log(`[Info] New account request (${username})`);
					fs.appendFile(pathToUserAccountRequests, userRecord + '\n', function (err) {
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
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} checkPath 
 * @param {*} callback 
 */
module.exports.authorize = function checkAuthorization(req, res, root, checkPath, callback) {
	fs.readFile(path.join(checkPath, ".authorized_users"), (err, data) => {
		if (err) {
			if (err.code == 'ENOENT') {
				// Recurse up the tree looking for the closest .authorized_users file
				if (path.relative(checkPath, root) === path.basename(root)) {
					// At the root, default to open.
					callback();
				} else {
					checkAuthorization(req, res, root, path.dirname(checkPath), callback);
				}
				return;
			}
			log(`[Error] Authorization Failure: ${err}`);
		}

		const name = getUserName(req);

		// If the user is not authenticated, prompt for them to log in
		// TODO: Debug an issue with this. Navigating to an authorized non-private resource seems to not work with some (???) accounts
		if (!name) {
			sendLoginPrompt(res);
			return;
		}

		// Check whether the logged in user is on the list of authorized users for this resource.
		if (data.toString().split('\n').map(authorizedUser => authorizedUser.replace('\r','')).includes(name)) {
			callback();
		} else {
			res.writeHead(403, {"Content-Type": "text/plain"});
			res.end("Access Forbidden");
			log(`[Warning] unauthorized access attempt by ${name} to ${checkPath}`);
		}
	});
}

function getPasswordHash(salt, password, callback) {
	pbkdf2(password, salt, 10000, 64, 'sha512', callback);
}

/**
 * Get current user name from auth headers.
 *
 * @param {HttpRequest} req Node's request object
 *
 * @return {string?} User name
 */
function getUserName(req) {
	const auth = req.headers.authorization;
	const parts = auth && auth.split(' ');
	const credentials = parts && parts.length > 1 && Buffer.from(parts[1], 'base64').toString('ascii').split(':');
	return credentials && credentials[0];
}

