/**
 * This module passes all arguments through to console.log and adds a few
 * convenience functions to tag log entries with a simple error level.
 *
 * Because log management may vary by system or installation, this module
 * duplicates recent log entries into a "dailies" log file to enable a
 * system-agnostic real-time status page.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const pathToDailyLog = path.join(__dirname, '..', 'administration', 'dailies.log');
let dailies = fs.createWriteStream(pathToDailyLog, {flags: 'a+'});

// HACK: Set a fake timestamp that can't be old enough to delete the dailies
// while things log during initialization. This prevents an error caused by
// trying to delete the dailies before reading the first line.
//
// The best way to replace this would be a clean way to synchronously read the
// first line of a file so we can initialize an actual value for the "oldest log
// entry" timestamp before allowing anything to log.
let currentOldestTimestamp = Date.now();

// Read just the first line of the current daily log.
const rl = readline.createInterface({
	input: fs.createReadStream(pathToDailyLog)
}).on('line', oldestDailyEntry => {
	rl.close();
	rl.removeAllListeners();

	currentOldestTimestamp = oldestDailyEntry.split(' ')[0];
	turnoverDaily(Date.now());
});

module.exports = (...args) => {
	console.log(...args);

	const now = Date.now();
	turnoverDaily(now);

	dailies.write(`${now} ${args.join(' ')} ${os.EOL}`);
}

module.exports.info = (...args) => module.exports("[Info]", ...args);
module.exports.error = (...args) => module.exports("[Error]", ...args);
module.exports.warning = (...args) => module.exports("[Warning]", ...args);

module.exports.tags = (...tags) => `${tags.map(tag => `(${tag})`).join(' ')}`;
module.exports.tag = module.exports.tags;

/**
 * Compare the given timestamp against the oldest log in the daily log file.
 * If the oldest log is old enough, wipe the daily log file.
 *
 * @param {timestamp} now
 */
function turnoverDaily(now) {
	const todaysMidnight = new Date(now);
	todaysMidnight.setHours(0,0,0,0);

	if (currentOldestTimestamp < todaysMidnight.getTime()) {
		// Clear the log when oldest entry is from before the most recent midnight.
		dailies.close();
		dailies = fs.createWriteStream(pathToDailyLog, {flags: 'w'});
		currentOldestTimestamp = now;
		module.exports.info('Turnover dailies.')
	}
}

/**
 * This function loads and parses the current daily log to render as a graph of
 * relative counts of requests per hour.
 *
 * The result is a simple HTML page of pre-formatted text.
 *
 * @param {Node's request object} req  https://nodejs.org/api/http.html#http_class_http_clientrequest
 * @param {Node's response object} res https://nodejs.org/api/http.html#http_class_http_serverresponse
 */
module.exports.sendStatusPage = (_req, res) => {
	const hours = {};
	for(let hour=0; hour < 24; hour++)
		hours[hour]={
			pages: {},
			total: 0,
		};
	readline.createInterface({
		input: fs.createReadStream(pathToDailyLog)
	}).on('line', line => {
		let parts = line.split(' ');
		const timestamp = Number(parts.splice(0,1)[0]);
		const _logLevel = parts.splice(0,1)[0];
		let message = parts.join(' ').trim();
		const tags = [];
		let tagOpen = message.indexOf('(');
		let tagClose = message.indexOf(')');
		while(tagOpen == 0 && tagOpen < tagClose) {
			let tag = message.substring(tagOpen, tagClose + 1);
			tags.push(tag.substring(1, tag.length - 1));
			message = message.replace(tag, '').trim();

			tagOpen = message.indexOf('(');
			tagClose = message.indexOf(')');
		}

		if (tags.includes('Request')) {
			let date = new Date(timestamp);
			let data = JSON.parse(message);

			if(!hours[date.getHours()].pages[data.for]) hours[date.getHours()].pages[data.for] = 0;
			hours[date.getHours()].pages[data.for]++
			hours[date.getHours()].total++;

		}
	}).on('close', () => {
		const bottomChar='&#x2500', wallChar='&#x2551', barChar='&#x2588';
		let bottomLine='';

		for(var i=0;i<32;i++) {
			if (i==4) {
				bottomLine+="&#x2568"
			} else if (i==31) {
				bottomLine+="&#x255C";
			} else {
				bottomLine+=bottomChar;
			}
		}

		res.writeHead("200");
		res.write(
`<html>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<head>
		<title>Today So Far</title>
		<style>
			.graph {
				display: block;
				text-align: center;
				margin: 0 1rem;
			}

			.status-stamp {
				display: inline-block;
				padding: 0 1rem;
				border: 1px solid black;
			}

			.status-stamp > h3 {
				margin-top: .75rem;
				border-bottom: 1px solid black;
			}
		</style>

		<!--tree control script and styles from W3 Schools https://www.w3schools.com/howto/howto_js_treeview.asp -->
		<style>
			/* Remove default bullets */
			ol {
				list-style-type: none;
			}

			/* Style the caret/arrow */
			.caret {
				cursor: pointer;
				user-select: none; /* Prevent text selection */
			}

			/* Create the caret/arrow with a unicode, and style it */
			.caret::before {
				content: "▷";
				color: black;
				display: inline-block;
				margin-right: 6px;
			}

			/* Rotate the caret/arrow icon when clicked on (using JavaScript) */
			.caret-down::before {
				content: "▶";
				transform: rotate(90deg);
			}

			/* Hide the nested list */
			.nested {
				display: none;
			}

			/* Show the nested list when the user clicks on the caret/arrow (with JavaScript) */
			.active {
				display: block;
			}
		</style>
		<script>
			const logData = ${JSON.stringify(hours)};
		</script>
	</head>
	<body>`);
	let max = Object.keys(hours).reduce((max, hour) => {
		if (hours[hour].total > max) max = hours[hour].total;
		return max;
	}, 0);

	res.write('<div class="status-stamp">\n');
	res.write(`<h3>${(new Date(Date.now())).toLocaleDateString("en-US", {month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "numeric"})}</h3>`);
	res.write('<div>\n');
	res.write(`
		<div>
			Load Avg. ${os.loadavg().map(o => `<strong>${o}</strong>`).join(' &#x2014; ')} <em>(over 1 &#x2014 5 &#x2014 15 minutes)</em>
		</div>`);

	res.write(`
		<div>
			Mem. <strong>${(os.freemem()/Math.pow(1024, 3)).toFixed(2)}</strong> / <strong>${(os.totalmem()/Math.pow(1024,3)).toFixed(2)}</strong> GiB <em>(free / total)</em>
		</div>`);

	res.write(`
		<div>
			Up for <strong>${Math.trunc(os.uptime() / 86400)}</strong> days
		</div>`);
	res.write('</div>');

	res.write('<div class="graph">\t<pre>');
	res.write('    &#x2553;&#x2500;&#x2500;&#x2500; Requests Per Hour &#x2500;&#x2500;&#x2500;&#x2500;&#x2556;\n');
	for(var i=10;i>0;i--) {
		let row = Object.keys(hours).reduce((line, hour) => {
			if (hours[hour].total > line.label) line.label = hours[hour].total;
			line.data += (((hours[hour].total*100) / max) >= (i*10)) ? barChar : ' ';
			return line;
		}, {data: '', label: 0});
		let scale = Math.trunc(row.label/(11-i));
		res.write(`${(i==10||i==1?scale:"").toString().padEnd(4, ' ')}${wallChar} ${row.data} ${wallChar}`+ '\n');
	}
	res.write(bottomLine);
	res.write('</pre>\n</div>\n');
	res.write('</div>\n<br>\n');

	// HACK: helps render a more readable output in a relatively concise way but should be improved.
	timeNameSequence = ["Midnight", "Noon", "Noon"];
	timeNameIndex = 0;
	res.write('<ol>\n');
	// Build "details" data
		Object.keys(hours).forEach(h => {
			let hour=hours[h];
			h = Number(h);
			hour.start = h % 12 || timeNameSequence[timeNameIndex++ % timeNameSequence.length];
			hour.end = (h + 1) % 12 || timeNameSequence[timeNameIndex++ % timeNameSequence.length];;
			let digitCount = 0;
			if (hour.pages[0]) digitCount = hour.pages[0].length;
			res.write('<li>\n');
			res.write(`<div class="caret"><b>${hour.start}${h % 12 ? ':00' : ''}</b> - <b>${hour.end}${(h + 1) % 12 ? ':00' : ''}</b>${ timeNameSequence.includes(hour.end) ? '' : `${(h + 1) < 12 ? "<em>am</em>" : "<em>pm</em>" }`} &#x2014; <strong>${hour.total}</strong> hits for <strong>${Object.keys(hour.pages).length}</strong> pages</div>\n`);
			res.write('<ol class="nested">\n');
			// TODO: Add a "Total redirects" stat for http->https redirects
			res.write(Object.keys(hour.pages).map(key => ({page: key, hits: hour.pages[key]})).sort((a,b) => b.hits - a.hits).map(({page, hits}) => `<li>${hits.toString().padStart(digitCount, ' ')}: ${page}</li>`).join('\n'));
			res.write('</ol>\n');
			res.write('</li>\n');
		});
	res.write('</ol>\n');

	res.write(`
		<script>
			var toggler = document.getElementsByClassName("caret");
			var i;

			for (i = 0; i < toggler.length; i++) {
				toggler[i].addEventListener("click", function() {
					this.parentElement.querySelector(".nested").classList.toggle("active");
					this.classList.toggle("caret-down");
				});
			}
		</script>
`);
	res.end(
`	</body>
</html>`);
	});
}

