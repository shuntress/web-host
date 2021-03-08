/**
 * This module groups all configuration defaults in one place and handles
 * overriding defaults from the optional administration/config.json file.
 */

const path = require('path');
let config = null;
try {
	config = require(path.join(__dirname, '..', 'administration', 'config.json'));
} catch (_e) {}

module.exports.httpPort = config?.httpPort ?? 80;

module.exports.serverPrivateKeyPath = config?.serverPrivateKeyPath ?? path.join(__dirname, '..', 'administration', 'key.pem');
module.exports.serverCertificatePath = config?.serverCertificatePath ?? path.join(__dirname, '..', 'administration', 'certificate.pem');
module.exports.httpsPort = config?.httpsPort ?? 443;

module.exports.dailyLogFile =  path.join(__dirname, '..', 'administration', 'dailies.log');

module.exports.indices = config?.indices ?? {};

module.exports.wwwRoot = config?.wwwRoot ?? path.join(__dirname, '..', 'www');
module.exports.controllerRoot = config?.controllerRoot ?? path.join(__dirname, '..', 'controllers');

module.exports.pathToUserCredentials = config?.pathToUserCredentials ?? path.join(__dirname, '..', 'administration', 'user_credentials.txt');
module.exports.pathToUserAccountRequests = config?.pathToUserAccountRequests ?? path.join(__dirname, '..', 'administration', 'account_creation_requests.txt');

module.exports.totalUsernameLimit = config?.totalUsernameLimit ?? 200;
