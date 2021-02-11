/**
 * This module should be called everywhere
 * that other modules want to log something.
 * 
 * I still haven't put much time into working
 * on how/where everything logs.
 * 
 * Logging straight to stdout seems to work
 * well enough with systemd but I tried to 
 * keep the only logging output contained here
 * anyway so that it will be easy to change.
 * @param {string} message 
 */

module.exports = (message) => {
	console.log(message);
}
