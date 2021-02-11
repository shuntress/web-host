/**
 * This module handles user access control
 *
 * This checks if a user has an authorized account
 * when they access any resource under the HTTPS root
 * directory.
 *
 * This module also controls the "Request Account" page
 * ( https://[my.website]/account )
 * When a user visits that URL and requests an account,
 * this module puts their account information in to the
 * "account_creation_requests.txt" file in the web-core
 * directory which must then be copied to the
 * "user_credentials.txt" file to activate their account.
 */

let authorized_credentials = null;

const fs = require('fs');
const url = require('url');
const { parse } = require('querystring');
const path = require('path');
const { randomBytes, pbkdf2 } = require('crypto');
const log = require(path.join(__dirname, 'log.js'));

const pathToUserCredentials = path.join(__dirname, '..', 'administration', 'user_credentials.txt');
const pathToUserAccountRequests = path.join(__dirname, '..', 'administration', 'account_creation_requests.txt');

module.exports.init = () => {
	let users = '';
	try {
		users = fs.readFileSync(pathToUserCredentials, 'ascii');
	}
	catch (err) {
		if (err.code != 'ENOENT') {
			throw err;
		}
	}

	authorized_credentials = users.split('\n').filter(row => row != '').map(row => {
		const parts = row.split(' ');
		return { name: parts[0], salt: parts[1], pwHash: parts[2] };
	}).reduce((acc, user) => {
		acc[user.name] = { salt: user.salt, pwHash: user.pwHash };
		return acc;
	}, {});
};

module.exports.authorize = function authorize(req, res, callback) {
	// Check if the user is loading the account request form
	const parsedUrl = url.parse(req.url);
	const urlparts = parsedUrl.pathname.split('/').filter(part => part != '');
	if (urlparts.length == 1 && urlparts[0] == 'account') {
		accountForm(req, res);
		return true;
	}

	// check whether this url should be protected
	if (req.url && !req.url.includes("private")) {
		// If this is not private, let it through.
		callback();
		return true;
	}

	const auth = req.headers.authorization;
	const parts = auth && auth.split(' ');
	const credentials = parts && parts.length > 1 && Buffer.from(parts[1], 'base64').toString('ascii').split(':');

	if (!credentials || authorized_credentials[credentials[0]] == null) {
		log('Unauthorized: credentials not provided');
		res.setHeader('WWW-Authenticate', 'Basic realm="log in please"');
		res.writeHead(401);
		res.end("Access Denied");
		return false;
	}
	const username = credentials && credentials[0];
	const password = credentials && credentials[1];
	const salt = authorized_credentials[username].salt;

	getPasswordHash(salt, password, (err, pwHash) => {
		if (authorized_credentials[username].pwHash == pwHash.toString('base64')) {
			callback();
		} else {
			log('Unauthorized: Wrong Password');
			res.setHeader('WWW-Authenticate', 'Basic realm="log in please"');
			res.writeHead(401);
			res.end("Access Denied");
		}
	});
};

function accountForm(req, res) {
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
			const username = path.normalize(body.username);
			const password = path.normalize(body.password);
			const salt = randomBytes(64).toString('base64');

			if (username.includes(' ') || username.length > 64) {
				// Username Validation failed
				log(`Invalid username request ${username}`);
				res.writeHead(400);
				res.end('Invalid Username');
				return;
			}

			getPasswordHash(salt, password, (err, pwHash) => {

				if (err) {
					log(err);
					res.writeHead(500);
					res.end();
					return;
				}

				const userRecord = `${username} ${salt} ${pwHash.toString('base64')}`;
				log(`New account request (${username})`);
				fs.appendFile(pathToUserAccountRequests, userRecord + '\n', function (err) {
					if (err) throw err;
					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end('Account requested.');
				});
			});
		});
	}
}

function getPasswordHash(salt, password, callback) {
	pbkdf2(password, salt, 10000, 64, 'sha512', callback);
}
