var
	colors = require('colors')
	, util = require('util')
	, fs = require('fs')
;

// TODO: add sprintf support to log messages.

function logger(opts) {

	this.opts = opts || { };
	this.lastLogged = undefined;
	this.stream = undefined;

	this.createStream();

	return this;
};


logger.prototype.streamError = function streamError(err) {

	console.log(

		[
			"%s ("
			, "ERROR".red
			, ") logger: %s"
		].join("")
		, now()
		, err
	);
};

logger.prototype.createStream = function createStream() {

	/**
	 * Only supporting local logging for now.
	 */
	if(!this.opts.logFile) {

		return false;
	}

	this.stream = fs.createWriteStream(this.opts.logFile, {

		flags : 'a'
		, encoding : 'utf8'
		, mode : this.opts.logPerms || 0600
	});

	var myLogger = this;
	this.stream.on('error', function(err) {

		myLogger.streamError(err);
		setTimeout(function reStream() {

			myLogger.createStream.call(myLogger);
		}, 5000);
	});

	return this.stream || undefined;
};

logger.prototype.log = function log() {

	/**
	 * Log something with a timestamp
	 */
	var args = Array.prototype.slice.call(arguments);
	var type = args.shift();
	var l = util.format.apply(null, args);
	if(l == this.lastLogged) { return; }
	var str = [ now(), type, l ].join(' ');
	this.stream.write(str + "\n");
	console.log(str);
	this.lastLogged = l;
};

logger.prototype.debug = function debug() {

	if(this.opts.env != "development"
		&& this.opts.env != "hacking") { return; }

	this.msg.call(this, 'DEBUG'.cyan, arguments);
};

logger.prototype.info = function info() {

	this.msg.call(this, 'info'.green, arguments);
};

logger.prototype.error = function error() {

	var args = Array.prototype.slice.call(arguments);
	if(args[0] instanceof Error && process.env.NODE_ENV == "development") {

		var str = [

			now()
			, '(' + 'ERROR'.magenta + ')'
			, args[0].stack
		].join(' ');

		this.stream.write(str + "\n");
		return console.log(str);
	}
	this.msg.call(this, 'ERROR'.red, arguments);
};

logger.prototype.warn = function warn() {

	this.msg.call(this, 'warn'.yellow, arguments);
};

logger.prototype.msg = function msg(type, args) {

	var args = Array.prototype.slice.call(args);
	args.unshift('('+(type || 'info')+')');
	this.log.apply(this, args);
};

function now() {

	return '['.white + (new Date()).toUTCString().grey + ']'.white;
}

module.exports = logger;
