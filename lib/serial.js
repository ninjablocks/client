var
	path = require('path')
	, serial = require('serialport')
	, logger = require(path.resolve(__dirname, 'logger'))
	, log
;


var serial = function(opts) {
	
	this.opts = opts || {};

	log = logger.default;
	
	if(!opts.device) { 

		log.debug('Attempt to initialize invalid serial device.');
		return false; 
	}

	log.info('Initializing serial device: %s', opts.device)

	// initialize serialport
	// emit handle
}

module.exports = serial;
