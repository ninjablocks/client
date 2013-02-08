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
;

/**
 * platform.device = serial / net stream to device data (JSON stream)
 * 
 */
function platform(opts, app) {
	
	stream.call(this);

	this.app = app;
	this.log = app.log;
	this.device = undefined;

	if((!opts.devicePath) && opts.env == "production") {

		opts.devicePath = "/dev/ttyO1";
	}
	// don't bother if neither are specified
	if(!opts.devicePath && !opts.deviceHost) {

		return this.log.info("platform: No device path or host specified");
	}

	if(opts.deviceHost) {
		
		var str = this.createNetStream(opts.deviceHost, opts.devicePort);
	}

	else {

		if(!checkPath(opts.devicePath)) { 

			return this.log.error(

				"platform: Device path doesn't exist? (%s)"
				, opts.devicePath
			);
		}
	
		var str = this.createSerialStream(opts.devicePath);
	}

	if(!str) {

		this.log.error("platform: Error creating device stream");
	}
	function checkPath(path) {

		var exists = fs.existsSync || path.existsSync;
		return exists(path);
	};
};

util.inherits(platform, stream);

platform.prototype.createNetStream = function createNetStream(host, port) {

	var mod = this;

	if(!host) { return false; }
	if(!port) { port = 9000; } // default!

	mod.deviceHost = host;
	mod.devicePort = port;
	mod.device = net.connect(port, host, connectHandler);
	mod.device.on('error', mod.onError.bind(mod));
	mod.device.on('close', mod.onClose.bind(mod));
	mod.log.debug(

		"platform: Opening net connection (%s:%s)"
		, mod.deviceHost
		, mod.devicePort
	);
	function connectHandler() {

		mod.log.info("platform: Net connection established");
	}
	return mod.device;
};

platform.prototype.createSerialStream = function createSerialStream(path) {

	var mod = this;
	if(!path) { return false; }
	mod.devicePath = path;
	mod.device = new serialport.SerialPort(opts.devicePath, {

		parser : serialport.parsers.readline("\n")
		, baudrate : 115200
	});
	mod.device.on('error', mod.onError.bind(mod));
	mod.device.on('close', mod.onClose.bind(mod));
	mod.log.debug(

		"platform: Opening serial connection (%s)"
		, mod.devicePath
	);
	return mod.device;
};

platform.prototype.onOpen = function onOpen() {

	this.log.debug("platform: Connection established");
};

platform.prototype.onClose = function onClose() {

	this.log.debug("platform: Connection closed");
};

platform.prototype.onError = function onError(err) {

	this.log.error("platform: %s", err);
};

platform.prototype.dataEvent = function dataEvent(type, data) {

	var trigger = {

		'ACK' : function(data) {

			this.ackHandler(data.ACK || null);
		}
		, 'DEVICE' : function(data) {

			this.deviceHandler(data.DEVICE || null);
			this.log.debug("Device data: %s", data.DEVICE);
		}
		, 'PLUGIN' : function(data) {

			this.log.debug("Device plugin: %s", data.PLUGIN);
		}
		, 'UNPLUG' : function(data) {

			this.log.debug("Device unplug: %s", data.UNPLUG);
		}
		, 'ERROR' : function(data) {

			this.log.debug("Device error: %s", data);
		}
	}

	if(!trigger[type]) {

		this.log.debug("Unrecognized data event %s", type);
		return;
	}

	trigger[type](data);
};

platform.prototype.deviceHandler = function(dataset) {
	
	/**
	 * device specific data handlers
	 */
	var handlers = {

		2 : this.accelerometerData
	};

	if(!(dataset instanceof Array)) { return; }

	dataset.map(function(device) {

		if(handlers[device.D]) {

			handlers[device.D](device);
		}
		else {

			this.sendData(device);
		}
	});	
};

platform.prototype.accelerometerData = function(data) {

};

platform.prototype.sendData = function(data) {
	
	if(!data) { return; }

	app.emit('device::data', data);
};

platform.prototype.getJSON = function getJSON(data) {
	
	try {

		return JSON.parse(chunk);
	}	
	catch (e) {

		this.log.debug("Ignoring invalid JSON (%s)", data);
	}
	return null;
};

module.exports = platform;
