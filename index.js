/**
 * This module handles displaying the list of
 * Folders/Files available in a given folder
 * 
 * It parses the path out of the URL in the request
 * Then loads the contents of that directory.
 */

const fs = require('fs');
const url = require('url');
const path = require('path');

const log = require(path.join(__dirname, 'log.js'));

module.exports = function(root, index, req, res) {
  const decoded_pathname = path.normalize(decodeURIComponent(url.parse(req.url).pathname));
  const relative_pathname = path.join(root, decoded_pathname);
  
  if (index && decoded_pathname === '/') {
     fs.readFile(path.join(root,index), 'ascii', (err, data) => {
          res.write(data);
          return res.end();
     });
  } else {
 
  fs.lstat(relative_pathname, function(err, stats) {
    if (err) {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
    
    if (stats.isFile()) {
      checkAuthorization(req, res, path.dirname(relative_pathname), () => fs.readFile(relative_pathname, function(err, data) {
        if (err) {
          res.writeHead(404);
          return res.end("404 Not Found");
        }
        const mimeType = mimeMap[path.extname(relative_pathname)];
        const filename = path.basename(relative_pathname);

				// "resume Download" partial file
				if ((mimeType == 'audio/mpeg' || mimeType == 'audio/flac') && req.headers.range && req.headers.range.includes('=') && req.headers.range.includes('-')){
					let rangeString = req.headers.range.split('=')[1].split('-');
					let rangeStart = rangeString[0];
					let rangeEnd = rangeString[1];
					if (rangeEnd == 'null' || rangeEnd == '') rangeEnd = stats.size-1;

					if (isNaN(rangeStart) || (Number(rangeStart) > data.length-1) || (rangeEnd != 'null' && isNaN(rangeEnd)) || (rangeEnd != 'null' && (Number(rangeEnd) > stats.size-1))) {
						res.writeHead(416);
						return res.end('Range Not Satisfiable');
					}

					res.writeHead(206, mimeType ? {"Content-Type": mimeType, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${stats.size}`, 'Content-Length': Number(rangeEnd) - Number(rangeStart) +1} : null);
					res.write(data.slice(Number(rangeStart), Number(rangeEnd) + 1));
					return res.end();
				} else {
	        res.writeHead(200, mimeType ? {"Content-Type": mimeType} : null);
				}
        res.write(data);
        return res.end();
      }));
    } else if (stats.isDirectory()) {
      checkAuthorization(req, res, relative_pathname, () => {
        fs.readdir(relative_pathname, (err, files) => {
          const parent_dir = path.dirname(decoded_pathname);
          res.writeHead(200);
          res.write(
`<html>
<meta charset="UTF-8">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      ul {
        list-style-type: none;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <ul>
    ${parent_dir ? `<li><a href="${parent_dir}">..</a></li>`:''}
    ${files.map(file =>`<li><a href="${path.join(decoded_pathname, encodeURIComponent(file))}">${file}</a>`).join('\n\t')}
    </ul>
  </body>
</html>`);
          return res.end();
        })
      })
    } else {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
  });
  }
};

function checkAuthorization (req, res, checkPath, callback) {
  fs.readFile(path.join(checkPath, ".authorized_users"), (err, data) => {
    if (err) {
      if (err.code == 'ENOENT') {
        callback();
        return;
      }
      log(`Authorization Failure: ${err}`);
    }

    const name = getUserName(req);
    if (data.includes(name)) {
      callback();
    } else {
      res.writeHead(403, {"Content-Type": "text/plain"});
			res.end("Access Forbidden");
      log(`unauthorized access attempt by ${name} to ${checkPath}`);
    }
  });
}

/**
 * This is fine.
 *
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

/**
 * Get current user.
 *
 * TODO: Fix this
 * This should definitely go somewhere better
 */
function getUserName(req) {
	const auth = req.headers.authorization;
	const parts = auth && auth.split(' ');
	const credentials = parts && parts.length > 1 && Buffer.from(parts[1], 'base64').toString('ascii').split(':');
	return credentials[0];
}
