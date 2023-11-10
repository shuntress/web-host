/**
 * This module handles testing.
 *
 * Tests are expected to be run automatically on start and abort the server if any fail.
 */
const path = require("path");
const auth = require(path.join(__dirname, "auth.js"));
const log = require(path.join(__dirname, "log.js"));
const route = require(path.join(__dirname, "route.js"));
const config = require(path.join(__dirname, "config.js"));

module.exports = () => {
	log("The web server...");
	module.exports.tests.forEach((test) => {
		log(`\t • ${test.label} ${test.result ? "✔️" : "❌"}`);
	});
};
module.exports.tests = [];

function it(name, test) {
	test.label = name;
	test.result = true;
	test();
	module.exports.tests.push(test);
}

function fail() {
	arguments.callee.caller.result = false;
	module.exports.fail = true;
}

function assert(condition) {
	if (!condition) {
		fail();
	}
}

it('should not let requests run a plugin\'s "init" method', () => {
	const args = {
		req: {
			url: "http://www.example.com",
			protocol: "http",
			headers: {
				host: "example.com",
			},
		},
		res: {
			writeHead: () => {},
			end: () => {},
		},
	};
	route.dispatch(args.req, args.res);
});
