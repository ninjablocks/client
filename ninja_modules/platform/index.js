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
;

/**
 * platform.device = serial / net stream to device data (JSON stream)
 * 
 */
function platform(opts, app) {
	
	var str = undefined;

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
};

util.inherits(platform, stream);

platform.prototype.createStream = function createStream(opts) {

	var opts = opts || this.opts;
	if(opts.deviceHost) {
		
		return str = this.createNetStream(

			opts.deviceHost
			, opts.devicePort
		);
	}
	else {
	
		return str = this.createSerialStream(opts.devicePath);
	}
	return false;
};

platform.prototype.createNetStream = function createNetStream(host, port) {

	var mod = this;

	if(!host) { return false; }
	if(!port) { port = 9000; } // default!
	mod.opts.devicePath = undefined;
	mod.opts.deviceHost = host;
	mod.opts.devicePort = port;
	mod.device = net.connect(port, host, function() {
		
		mod.log.info("platform: Net connection established");
	});
	mod.bindStream(mod.device);

	mod.log.debug(

		"platform: Opening net connection (%s:%s)"
		, mod.opts.deviceHost
		, mod.opts.devicePort
	);
	return mod.device;
};

platform.prototype.createSerialStream = function createSerialStream(path) {

	var mod = this;

	if(!fs.existsSync(opts.devicePath)) { 

		mod.log.error(

			"platform: Serial device path unavailable (%s)"
			, path
		);
	}
	if(!path) { return false; }
	mod.opts.deviceHost = undefined;
	mod.opts.devicePath = path;
	mod.device = new serialport.SerialPort(mod.opts.devicePath, {

		parser : serialport.parsers.readline("\n")
		, baudrate : 115200
	});
	mod.device.on('open', function() {

		mod.log.info("platform: Serial connection established");
		mod.bindStream(mod.device);
	})

	mod.log.debug(

		"platform: Opening serial connection (%s)"
		, mod.opts.devicePath
	);
	return mod.device;
};

platform.prototype.bindStream = function bindStream(str) {

	var mod = this;
	if(!(str instanceof stream)) { return false; }
	str.on('error', mod.onError.bind(mod));
	str.on('close', mod.onClose.bind(mod));
	mod.channel = new through(mod.onData.bind(mod));
	str.pipe(mod.channel).pipe(str);
	return true;
};

platform.prototype.onClose = function onClose() {

	if(this.device.errorEmitted) { return; }
	this.log.info(

		"platform: Device connection lost (%s)"
		, this.opts.devicePath || this.opts.deviceHost
	)
	setTimeout(this.createStream.bind(this), 2000);
};

platform.prototype.onError = function onError(err) {

	this.log.error(

		"platform: %s (%s)"
		, err
		, this.opts.devicePath || this.opts.deviceHost
	);
	setTimeout(this.createStream.bind(this), 2000);
};

platform.prototype.onData = function onData(dat) {
	
	dat = dat.toString() || "";
	if(!dat) { return; }

	this.log.debug(dat);
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
