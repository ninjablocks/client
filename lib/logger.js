function logger(opts) {
	
	this.opts = opts || { };


	return this;
};

logger.prototype.log = function log() {
	
	/**
	 * Log something with a timestamp
	 */
	var args = Array.prototype.slice.call(arguments);
	args.unshift('['+(new Date()).toUTCString()+']');

	console.log.apply(this, args);

};

logger.prototype.debug = function debug() {

	/**
	 * Only log if we are in dev mode
	 */
	if(this.opts.env != "development") { return; }

	var args = Array.prototype.slice.call(arguments);
	args.unshift('(DEBUG)');
	this.log.apply(this, args)
};

module.exports = logger;
