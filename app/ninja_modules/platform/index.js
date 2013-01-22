/**
 * Ninja Blocks arduino controller
 */

var 
	stream = require('stream')
	, util = require('util')
;

function platform(opts, app) {
	
	this.app = app;
	this.log = app.log;

	this.newDevice = function newDevice(dev) {

		if(dev.id != 'arduino') { return; }

		app.log.debug("Initializing arduino...");

		dev.on('open', function() {

			console.log("Opened.");
		});
		dev.on('close', function() {

			console.log("Closed.");
		});
		dev.on('error', function(err) {

			console.log("Error. %s", err);
		});
		dev.on('data', function(dat) {

			// console.log("Data: %s", dat);
		});

		dev.connect();
	};

	this.onData = function onData(data) {

		var 
			json = this.getJSON(data)
			, type = Object.keys(json)[0] || undefined
		;

		if(!json || !type) {

			this.log.debug("Ignoring unexpected JSON (%s)", json);
			return;
		}

		this.dataEvent(type, json);
	};

	stream.call(this);
	app.on('serial::new', this.newDevice);

};

platform.prototype.onOpen = function onOpen() {

	this.log.debug("Arduino initialized");
};

platform.prototype.onClose = function onClose() {

	this.log.debug("Arduino disconnected");
};

platform.prototype.onError = function onError(err) {

	this.log.error("Arduino error: %s", err);
};

util.inherits(platform, stream);

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
