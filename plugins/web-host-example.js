/**
 * This module is a basic example of what you can
 * do with server-side code.
 *
 * This example has functions to create an html page
 * with a form from a template and parse/return the data
 * sent back from that form.
 */

const querystring = require("querystring");

let wwwRoot, log, auth, config;
module.exports.init = ({...args}) => {
	log = args.log;
	wwwRoot = args.wwwRoot;
	auth = args.auth;
	config = args.config;
};

module.exports.index = (req, res, data) => {
	const words = ["Hello", req.connection.remoteAddress];
	const testAction_view = `
	<html>
		<head>
				
		<body>
			${words
			.map(
				(word) => `
				<span>${word}</span>
			`
			)
			.join(` `)}
			<form method="POST" action="/web-host-example/post">
				<input type="text" name="someText" />
				<input type="test" name="otherText" />
				<input type="submit" value="Submit" />
			</form>

		</body>
	</html>
	`;

	res.writeHead(200);
	res.write(testAction_view);
	return res.end();
};

module.exports.post = (req, res, queryStringData) => {
	let body = [];
	req
		.on("data", (chunk) => {
			body.push(chunk);
		})
		.on("end", () => {
			body = Buffer.concat(body).toString();

			const queryData = querystring.parse(body);

			res.writeHead(200);
			res.end(JSON.stringify(queryData));
		});
};
