/**
 * This module is a basic example of what you can
 * do with server-side code.
 * 
 * This example has functions to create an html page
 * with a form from a template and parse/return the data
 * sent back from that form.
 */

const querystring = require('querystring');

let wwwRoot = '';

module.exports.init = (www_root) => {
	wwwRoot = www_root;
	return this;
};

module.exports.index = (req, res, data) => {
	const words = ['Hello', req.connection.remoteAddress];  
	const testAction_view = 
	`
	<html>
	  <head>
				
	  <body>
			${words.map(word =>`
				<span>${word}</span>
			`).join(` `)}
			<form method="POST" action="/example/post">
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
	req.on('data', (chunk) => {
		body.push(chunk);
	}).on('end', () => {
		body = Buffer.concat(body).toString();
		
		const queryData = querystring.parse(body);

		res.writeHead(200);
		res.end(JSON.stringify(queryData));
	});
};
