/**
 * This module handles displaying the list of Folders/Files available in a
 * given folder
 * 
 * It parses the path out of the URL in the request then loads the contents of
 * that file or directory. File content is simply returned. Directory content
 * is rendered with a template.
 */

const fs = require('fs');
const url = require('url');
const path = require('path');

const auth = require(path.join(__dirname, 'auth.js'));
const config = require(path.join(__dirname, 'config.js'));

const wwwRoot = config.wwwRoot;

module.exports = function(req, res) {
	const webPath = path.normalize(decodeURIComponent(url.parse(req.url).pathname));
	const absoluteSystemPath = path.join(wwwRoot, webPath);

	fs.lstat(absoluteSystemPath, function(err, stats) {
		if (err) {
			res.writeHead(404);
			return res.end("404 Not Found");
		}

		if (stats.isFile()) {
			auth.authorize(req, res, wwwRoot, path.dirname(absoluteSystemPath), () => {
				loadFile(req, res, stats, absoluteSystemPath);
			});
		} else if (stats.isDirectory()) {
			auth.authorize(req, res, wwwRoot, absoluteSystemPath, () => {
				loadDirectory(req, res, stats, webPath, absoluteSystemPath);
			})
		} else {
			res.writeHead(404);
			return res.end("404 Not Found");
		}
	});
}


/**
 * This function loads the requested file content and returns it through the
 * given Node response object.
 */
function loadFile(req, res, stats, absoluteSystemPath) {
	// Pre-Load checks
	const mimeType = mimeMap[path.extname(absoluteSystemPath)];
	const filename = path.basename(absoluteSystemPath);

	// Basis for content length calculation
	let rangeStart=0;
	let rangeEnd = Math.max(0, stats.size - 1);

	// "Resume Download" partial file
	let isPartialRequest = (mimeType == 'audio/mpeg' || mimeType == 'audio/flac') && req.headers.range && req.headers.range.includes('=') && req.headers.range.includes('-');
	if (isPartialRequest) {
		let rangeString = req.headers.range.split('=')[1].split('-');
		rangeStart = rangeString[0];
		rangeEnd = rangeString[1];
		if (rangeEnd == 'null' || rangeEnd == '') rangeEnd = stats.size-1;

		if (isNaN(rangeStart) || (Number(rangeStart) > stats.size-1) || (rangeEnd != 'null' && isNaN(rangeEnd)) || (rangeEnd != 'null' && (Number(rangeEnd) > stats.size-1))) {
			res.writeHead(416);
			return res.end('Range Not Satisfiable');
		}
	}

	// Load file content
	dataStream = fs.createReadStream(absoluteSystemPath, {start: Number(rangeStart), end: Number(rangeEnd)});
	dataStream.on('error', function(){
		res.writeHead(404);
		return res.end("404 Not Found");
	});

	// Set response headers
	const responseHeader = {
		"Content-Type": mimeType,
		"Content-Length": Number(rangeEnd) === Number(rangeStart) ? 0 : (Number(rangeEnd) + 1) - Number(rangeStart)
	};
	if (isPartialRequest) {
		responseHeader["Accept-Ranges"] = "bytes";
		responseHeader["Content-Range"] = `bytes ${rangeStart}-${rangeEnd}/${stats.size}`;
	}
	res.writeHead(isPartialRequest ? 206 : 200, mimeType ? responseHeader : null);

	// Connect datastream to output
	dataStream.pipe(res);
}

/**
 * This function finds or generates an index of the given directory. If an
 * index is found either in the requested directory or configured for the
 * current domain root, then a redirect to the found index is sent back through
 * the given Node response object. If no index is found, one is generated from
 * a template and sent back as the content of the response (no redirect).
 */
function loadDirectory(req, res, stats, webPath, absoluteSystemPath) {
	fs.readdir(absoluteSystemPath, (err, files) => {

		// If this request is for the root directory, check for an optionally
		// configured index file matched on domain name. This configuration comes
		// from web-host/administration/config.json and is expected to be a simple
		// key:value pair of domain:indexFile
		// If this is not a domain root or if no index is configured, check for a file named "index"
		const index = ((webPath === '/') && config.indices[req.headers.host]) || files.find(file => file === "index.html");

		if (index) {
			// If an index file has been found, redirect to that instead of generating an index for this directory.
			res.writeHead("302", {"Location": path.join(webPath, index)});
			return res.end();
		}

		// Otherwise, since no index was found, generate and index for this directory using this template.
		const parentWebPath = path.dirname(webPath);
		const output =
`<html>
<meta charset="UTF-8">
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="/style.css">
		<link rel="stylesheet" href="/layout.css">
		<title>Index of ${webPath.split(path.sep).join('/')}</title>
	</head>
	<body>
		<div class="content">
			<h2>${path.basename(webPath)}</h2>
			<ul>
				${parentWebPath ? `<li><a href="${parentWebPath}">..</a></li>`:''}
				${files.map(file =>`<li><a href="${path.join(webPath, encodeURIComponent(file))}">${file}</a></li>`).join('\n\t')}
			</ul>
			<address>Modified: ${stats.atime.toLocaleDateString("en-US", {month: "short", day: "2-digit", year: "numeric"})}</address>
		</div>
	</body>
</html>`;
		res.writeHead(200, {"Content-Type": "text/html", "Content-Length": output.length});
		return res.end(output);
	});
}

/**
 * It would definitely be practical to just
 * include a module from npm that has all
 * MIME types but I am going to stick to
 * my _no_ dependencies premise.
 */
const mimeMap = {
	".html": "text/html",
	".txt": "text/plain",
	".json": "text/json",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
	".flac": "audio/flac",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".png": "image/png",
	".css": "text/css",
	".svg": "image/svg+xml",
	".md": "text/markdown",
	".markdown": "text/markdown"
};

