var
	serialport = require('serialport')
	, through = require('through')
	, stream = require('stream')
	, net = require('net')
	, fs = require('fs')
;

module.exports = deviceStream;

function deviceStream(platform) {

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
		dat = this.getJSON(dat) || [ ];
		if(!dat) { return; }
		Object.keys(dat).forEach(function(key) {

			mod.dataEvent(key, dat[key]);
		});
	};
};
