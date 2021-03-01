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
	<head>
		<style>
			.graph {
				display: inline-block;
				margin: 0 1rem;
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

	res.write('<div class="graph">\t<pre>');
	res.write('    &#x2553 Requests Per Hour       &#x2500&#x2556\n');
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

	res.end(
`	</body>
</html>`);
	});
}