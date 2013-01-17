var
	path = require('path')
	, util = require('util')
	, logger = require(path.resolve(__dirname, 'logger'))
	, log
;

var obi = function obi(opts) {
	
	this.opts = opts || {};

	
};

obi.getJSON = function getJSON(str) {

	try {

		return JSON.parse(str);
	}
	catch(err) {

		log.error(util.format('JSON parser error: %s', err));
		return null; 
	}
}

obi.execute = function execute(data) {

	var parsed = this.getJSON(data);
	if(!(parsed) || !parsed.DEVICE) {

		log.warn('Unable to execute command: invalid JSON.');
		return;
	}

	var 
		list = parsed.DEVICE
		, special = {

			1004 : "camera"
			, 1005 : "wifi"
		}
	;

	for(device in list) {

		var guid = list[device].GUID;
		delete list[device].GUID;
		list[device].G = list[device].G.toString();

		if(!list[device].D in special) {

			log.debug(util.format('Actuating %s (%s)', guid, list[device].DA));
			this.writeTTY(

				this.tty
				, JSON.stringify({ 'DEVICE' : [ list[device] ] })
			)
		}
	}
}

obi.writeTTY = function(tty, data, eb) {

	
}


module.exports = obi;
