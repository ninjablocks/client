/**
 * Ninja Blocks arduino controller
 */

var 
	serialport = require('serialport')
	, through = require('through')
	, stream = require('stream')
	, util = require('util')
	, path = require('path')
	, net = require('net')
	, fs = require('fs')
	, metaEvents = require('./lib/meta-events.js')
	, deviceStream = require('./lib/device-stream.js')
	, platformDevice = require('./lib/platform-device.js')
	, deviceHandlers = require('./lib/handlers.js')
;

/**
 * platform.device = serial / net stream to device data (JSON stream)
 * 
 */
function platform(opts, app) {

	var 
		str = undefined
		, mod = this
	;

	stream.call(this);
	this.app = app;
	this.log = app.log;
	this.opts = opts || { };
	this.device = undefined;
	this.channel = undefined;
	
	if((!opts.devicePath) && opts.env == "production") {

		this.opts.devicePath = "/dev/ttyO1";
	}
	// don't bother if neither are specified
	if(!opts.devicePath && !opts.deviceHost) {

		return this.log.info("platform: No device specified");
	}
	if(!this.createStream()) {

		this.log.error("platform: Error creating device stream");
	}


	this.LED = new platformDevice('0', 0, 1000);
	this.LED.state = "00FF00";
	app.on('client::up', function() {

		mod.LED.write = function(dat) {

			console.log(">>> WRITE %s", dat);
			var res = {
				
				DEVICE : [{

					G : '0'
					, V : 0
					, D : 1000
					, DA : dat
				}]
			};
			mod.device.write(JSON.stringify(res));
		};
		mod.emit('register', mod.LED);
		process.nextTick(function() {

			mod.LED.emit('data', '00FF00')
		})
	});
	
};

util.inherits(platform, stream);

deviceHandlers(platform);
deviceStream(platform);
metaEvents(platform);

platform.prototype.sendData = function(dat) {
	
	if(!dat) { return; }
	this.emit('data', dat);
	//console.log(dat);
};

platform.prototype.sendConfig = function(type, dat) {
	
	if(!dat) { return; }
	dat.type = type;
	this.emit('config', dat);
};

platform.prototype.getJSON = function getJSON(data) {
	
	try {

		return JSON.parse(data);
	}	
	catch(e) { }
	return null;
};

module.exports = platform;
