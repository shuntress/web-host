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
      fs.readFile(relative_pathname, function(err, data) {
        if (err) {
          res.writeHead(404);
          return res.end("404 Not Found");
        }
        const mimeType = mimeMap[path.extname(relative_pathname)];
        res.writeHead(200, mimeType ? {"Content-Type": mimeType} : null);
        res.write(data);
        return res.end();
      });
    } else if (stats.isDirectory()) {
      fs.readdir(relative_pathname, (err, files) => {
        const parent_dir = path.dirname(decoded_pathname);
        res.writeHead(200);
	
        res.write(
`<html>
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
    ${files.map(file =>`<li><a href="${path.join(decoded_pathname, encodeURIComponent(file))}">${file}</a></li>`).join(`
    `)}
		</ul>
  </body>
</html>`);

        return res.end();
      })
    } else {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
  });
  }
};

/**
 * This is fine.
 *
 * It would definitely be practical to just
 * include a module from npmjs that has all
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
	".svg": "image/svg+xml"
};
