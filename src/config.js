/**
 * This module groups all configuration defaults in one place and handles
 * overriding defaults with values from the optional administration/config.json
 */

const path = require('path');
let config = null;
try {
	config = require(path.join(__dirname, '..', 'administration', 'config.json'));
} catch (_e) {}

// Port to listen for HTTP requests
module.exports.httpPort = config?.httpPort ?? 80;

// Whether the site uses HTTP or HTTPS (with HTTP redirect)
module.exports.useHttps = config?.useHttps ?? false;

// Paths to key & cert files
module.exports.serverPrivateKeyPath = config?.serverPrivateKeyPath ?? path.join(__dirname, '..', 'administration', 'key.pem');
module.exports.serverCertificatePath = config?.serverCertificatePath ?? path.join(__dirname, '..', 'administration', 'certificate.pem');

// Port to listen for HTTP requests
module.exports.httpsPort = config?.httpsPort ?? 443;

// Path to temporary log duplicates file
module.exports.dailyLogFile =  path.join(__dirname, '..', 'administration', 'dailies.log');

// Specific index files to handle root requests by Domain.
/**
 * {
 * 	"Domain": "index_file.html"
 * }
 */
module.exports.indices = config?.indices ?? {};

// Path to the statically hosted directory
module.exports.wwwRoot = config?.wwwRoot ?? path.join(__dirname, '..', 'content');

// Path to custom server-side javascript modules
module.exports.controllerRoot = config?.controllerRoot ?? path.join(__dirname, '..', 'controllers');

// Path to account and account request data
module.exports.pathToUserCredentials = config?.pathToUserCredentials ?? path.join(__dirname, '..', 'administration', 'user_credentials.txt');
module.exports.pathToUserAccountRequests = config?.pathToUserAccountRequests ?? path.join(__dirname, '..', 'administration', 'account_creation_requests.txt');

// Part of crude brute-force countermeasures. If the total number of real user
// accounts and random-guess user accounts is greater than this number, then any
// login attempt for a new unknown user will return a 500.
// Tracking random guess usernames allows them to be treated and locked the same
// as real accounts.
module.exports.totalUsernameLimit = config?.totalUsernameLimit ?? 200;
