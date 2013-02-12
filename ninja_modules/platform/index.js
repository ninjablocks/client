/**
 * Ninja Blocks arduino controller
 */

var 
	serialport = require('serialport')
	, deviceMeta = require('./lib/meta')
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

	var 
		str = undefined
		, mod = this
		, devices = { }
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
	mod.device = net.connect(port, host, this.onOpen.bind(this));
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

	if(!fs.existsSync(mod.opts.devicePath)) { 

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
	mod.device.on('open', this.onOpen.bind(this));

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

platform.prototype.onOpen = function onOpen() {
	
	this.log.info(

		"platform: Device connection established (%s)"
		, this.opts.devicePath || this.opts.deviceHost
	)
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
	
	var mod = this;
	dat = this.getJSON(dat) || undefined;
	if(!dat) { return; }
	
	Object.keys(dat).forEach(function(key) {

		mod.dataEvent(key, dat[key]);
	});
};
platform.prototype.dataEvent = function dataEvent(type, dat) {

	var mod = this;
	var trigger = {

		'ACK' : function(dat) {

			this.ackHandler(dat.ACK || null);
		}
		, 'DEVICE' : function(dat) {

			mod.deviceHandler(dat);
		}
		, 'PLUGIN' : function(dat) {

			mod.pluginHandler(dat);
			mod.log.debug("Device plugin: %s", dat);
		}
		, 'UNPLUG' : function(dat) {

			mod.log.debug("Device unplug: %s", dat);
		}
		, 'ERROR' : function(dat) {

			mod.log.debug("Device error: %s", dat);
		}
	}

	if(!trigger[type]) {

		this.log.debug("Unrecognized data event %s", type);
		return;
	}

	trigger[type](dat);
};

platform.prototype.deviceHandler = function(dataset) {

	/**
	 * device specific data handlers
	 */
	var mod = this;

	if(!(dataset instanceof Array)) { return; }

	dataset.map(function(device) {

		if(deviceMeta[device.V][device.D]) {

			var meta = deviceMeta[device.V][device.D];
			if(mod[meta.method]) {

				mod[meta.method](device, meta);
			}
		}
		else {

			mod.sendData(device);
		}
	});	
};

platform.prototype.pluginHandler = function(dataset) {
	
	var mod = this;
	if(!(dataset instanceof Array)) { return; }

	dataset.map(function(device) {

		mod.sendConfig("PLUGIN", device);
	});
};
platform.prototype.transformAccelerometer = function(dat, meta) {

	if(!this.motionSample) {

		return this.motionSample = dat;
	}
	var samples = split(this.motionSample);
	if(!three(samples)){ return reset(); }

	var 
		sampleSum = reduce(samples)
		, current = split(dat)
	;
	if(!three(current)) { return reset(); }
	this.motionSample = dat;

	var 
		currentSum = reduce(current)
		, diff = currentSum - sampleSum
	;
	if(threshold(diff)) {

		console.log("JIGGLE")
		this.sendData({
			G : '0'
			, V : 0
			, D : 3
			, DA : 1
		});
	}
	function three(a) { return a.length == 3; } 
	function split(a) { return a.DA.split(','); }
	function reduce(s) { return s.reduce(add); }; 
	function add(v, i) { return parseInt(v) + parseInt(i); }
	function reset() { this.motionSample = undefined; }
	function threshold(diff) {

		return (diff > meta.sensitivity || diff < -meta.sensitivity)
	}
};

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
