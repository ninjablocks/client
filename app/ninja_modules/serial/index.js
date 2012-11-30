var 
	serialport = require('serialport')
	, device = serialport.SerialPort
	, stream = require('stream')
	, util = require('util')
;

function serial(opts, app) {
	
	var 
		opts = opts || {}
		, ready = false
		, unload = function() {

			if(this.device) {

				this.device.close();
			}
		}
	;
	this.app = app;	

	if(!opts.device) {

		app.emit(

			'error'
			, new Error("No device path specified for serial device.")
		);

		return null;
	}

	if(!opts.id) {

		app.emit(

			'error'
			, new Error("Invalid device ID specified.")
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

		if(!this.ready) { 

			this.ready = true;
			this.emit('ready', true);
		}
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


	this.on('unload', unload);


	return this;
};

util.inherits(serial, stream);

module.exports = serial;
