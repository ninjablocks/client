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

				log.debug("Unloading serial module for %s", opts.device);	
				this.emit('unload');
				this.device.close();
			}
		}
		, log = app.log
	;

	this.retry = {

		delay : 2000
		, reset : 120 * 1000
		, count : 0
		, max : 2
	};

	this.log = log;

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

		this.parser = serialport.parsers.readline("\n");
	}

	stream.call(this);

	this.id = opts.id;
	this.connect = function connect() {

		if(this.retry.count >= this.retry.max) {

			this.log.debug(

				"serial: Retrying in %s seconds (%s)"
				, this.retry.reset / 1000
				, this.id 
			);
			setTimeout(function() {

				this.retry.count = 0;
				this.connect();

			}.bind(this), this.retry.reset);

			return;
		}
		this.log.debug("serial: Connecting... (%s)", this.id);
		try {

			this.device = new device(opts.device, this.parser);
			this.device.path = opts.device;
			this.bindListeners();

		}
		catch(e) {

			++this.retry.count;
			app.emit('error', new Error("serial: Unable to connect to device"));
			setTimeout(this.connect, this.retry.delay);

		}

	}.bind(this);

	this.write = function write(data) {

		if(this.device) {

			try {

				this.device.write(data);
			}
			catch (e) {

				this.log.debug("serial: Write error: %s", e);
				return false;
			}
			return true;
		}
		return false;

	}.bind(this);

	this.on('unload', unload);
	app.emit('serial::new', this);

	return this;
};

util.inherits(serial, stream);

serial.prototype.bindListeners = function bindListeners() {

	var onOpen = function onOpen() {

		this.retry.count = 0;
		if(!this.ready) { 

			this.ready = true;
			this.emit('ready', true);
	
		}
		
		this.log.debug("Serial connection open on %s", this.device.path);
		this.emit('open');
		
	}.bind(this);

	var onClose = function onClose() {

		this.log.debug("Serial connection closed on %s", this.device.path);
		setTimeout(this.connect, this.retry.delay);
		this.emit('close');

	}.bind(this);

	var onError = function onError(err) {

		++this.retry.count;
		this.log.error("serial: %s (%s)", err, this.id);
		setTimeout(this.connect, this.retry.delay);
		// this.emit('error', err);

	}.bind(this);

	var onData = function onData(dat) {

		// this.log.debug("Serial data: %s", dat);
		this.emit('data', dat);

	}.bind(this);

	this.device.on('open', onOpen);
	this.device.on('close', onClose);
	this.device.on('error', onError);
	this.device.on('data', onData);
};

module.exports = serial;
