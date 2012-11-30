var 
	serialport = require('serialport')
	, device = serialport.SerialPort
	, stream = require('stream')
	, util = require('util')
;

function serial(opts, app) {
	
	var opts = opts || {};
	this.app = app;	

	if(!opts.device) {

		app.emit(

			'error'
			, new Error("No device path specified for serial device.")
		);

		return null;
	}

	if(opts.parser && typeof opts.parser !== 'object') {

		app.emit(

			'error'
			, new Error("Invalid serial parser provided.")
		);

		return null;
	}

	if(!opts.parser) {

		this.parser = serialport.parsers.raw;
	}

	stream.call(this);

	this.device = new device(opts.device, this.parser);

	this.device.on('open', function() {

		this.emit('open', this);
	}.bind(this));

	this.device.on('close', function() {

		this.emit('close', this);
	}.bind(this));

	this.device.on('error', function(err) {

		this.emit('error', err);
	}.bind(this));

	this.device.on('data', function(dat) {

		this.parser(this, dat);
	}.bind(this));

	return this;
};

util.inherits(serial, stream);

module.exports = serial;
