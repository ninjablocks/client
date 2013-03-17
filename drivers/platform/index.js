/**
 * Ninja Blocks arduino controller
 */

var
	serialport = require('serialport')
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
function platform(opts, app, version) {

	var
		str = undefined
		, mod = this
	;

	stream.call(this);
	this.app = app;
	this.log = app.log;
	this.opts = opts || { };
	this.queue = [ ];
	this.device = undefined;
	this.channel = undefined;
	this.debounce = [ ];

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

	/**
	 * Get version from arduino
	 */
	function getVersion() { mod.device.write('{"DEVICE":[{"G":"0","V":0,"D":1003,"DA":"VNO"}]}'); }

	this.once('open', function() {

		var versionSpam = setInterval(function() {

			getVersion();
		}, 500);

		mod.once('version', function(ver) {

			version(ver);
			clearTimeout(versionSpam);
		});
		
		setTimeout(function() {

			clearTimeout(versionSpam);
		}, 2000);
	});

	app.on('device::command', mod.onCommand.bind(mod));
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
