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
	
	this.statusLights = [

		{
			state : "client::up"
			, color : "00FF00"
		}
		, {
			state : "client::down"
			, color : "FFFF00"
		}
		, {
			state : "client::authed"
			, color : "00FFFF"
		}
		, {
			state : "client::activation"
			, color : "FF00FF"
		}
		, { 
			state : "client::invalidToken" 
			, color : "0000FF"
		}
		, {
			state : "client::reconnecting"
			, color : "00FFFF"
		}
	];
	

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

	this.eyes = new platformDevice('0', 0, 1000);

	/**
	 * Bind listeners for app state
	 * make the status LED do its thing
	 */
	this.statusLights.forEach(function(state) {

		app.on(state.state, function() {

			mod.device.write(JSON.stringify({
				DEVICE : [
					{ 
						G : "0"
						, V : 0
						, D : 999
						, DA : state.color
					}
				]
			}));
		});
	});

	this.eyes.pipe(this.device).pipe(this.eyes);
	/**
	 * Initializing stuff
	 */
	app.on('client::up', function() {

		mod.emit('register', mod.eyes);
		setTimeout(function() {

			//mod.status.write(mod.status.state || "00FF00");
			mod.eyes.write(mod.eyes.state || "00FF00");
		}, 2000);
	});	
};

util.inherits(platform, stream);

deviceHandlers(platform);
deviceStream(platform);
metaEvents(platform);

platform.prototype.sendData = function(dat) {
	
	if(!dat) { return; }
	this.emit('data', dat);
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
