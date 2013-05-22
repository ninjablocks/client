module.exports = metaEvents;

var RFInterpreter = require('./rf-interpreter');

function metaEvents(platform) {

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

			console.log("JIGGLE");

			this.emit('data', {
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

	platform.prototype.queueCommand = function queueCommand(device) {
		var
			mod = this
			, timeout = undefined
		;

		if(!this.queue) { this.queue = [ ]; }

		function listener(ack) {

			clearTimeout(timeout);

			if(mod.queue.length === 0) { return; }

			mod.queue.shift();
			if(mod.queue.length > 0) {

				write(mod.queue[0]);
			}
		};

		function write(dat) {

			delete dat.GUID;

			timeout = setTimeout(function queueTimeout() {

				mod.log.info(
					"ninja-arduino: Queued write timeout "
					, dat
				);

				listener([ dat ]);

			}, 2000);

			mod.once("ack", listener);
			mod.device.write(JSON.stringify({

				"DEVICE" : [ dat ]
			}));
		};

		this.queue.push(device);
		if(this.queue.length === 1) {

			write(device);
		}
	};

	platform.prototype.debounceCommand = function debounceCommand(device, timeout, postDebounceMethod) {

		var
			mod = this
			, guid = [ device.G, device.V, device.D ].join("_") || "undefined"
			, sendData = true
			, lastBounce
			, now
		;

		if(!guid) { return; }
		now = (new Date()).valueOf();
		lastBounce = this.debounce[guid] || undefined;

		if((lastBounce) && lastBounce.TIMESTAMP + timeout >= now) {

			sendData = false;
		}
		device.TIMESTAMP = (new Date()).valueOf();
		device.DEBOUNCED = true;
		this.debounce[guid] = device;

		if(!sendData) { return; }
		if (postDebounceMethod) {
			this[postDebounceMethod](device);
		}
		else {
			this.sendData(device);
		}
	};

	platform.prototype.savePersistantDevice = function savePersistantDevice(device) {
		var persistantDevices = this.opts.persistantDevices || [ ];
		var guid = [ device.G, device.V, device.D ].join("_")
		if (persistantDevices.indexOf(guid) < 0) {
			persistantDevices.push(guid);
			this.opts.persistantDevices = persistantDevices;
			this.save();
		}
	}

	platform.prototype.interpretRF = function interpretRF(device) {
		devices = RFInterpreter.devicesForDevice(device, this.version, this.log);
		for (var i=0; i<devices.length; i++) {
			this.sendData(devices[i]);
		}
	}

	platform.prototype.arduinoVersion = function arduinoVersion(stdout) {

		var v = {};

		if (stdout && stdout.indexOf('_')>-1) {
			var parts = stdout.split('_');
			v.arduinoModel = parts[0];
			v.arduinoVersion = parseFloat(parts[1]);
		} else if (stdout && stdout.length>0) {
			v.arduinoModel = 'V11';
			v.arduinoVersion = 0.36
		}
		this.setArduinoVersion(v);
	};

	platform.prototype.setArduinoVersion = function setArduinoVersion(v) {
		this.version = v;
		this.log.debug("ninja-arduino: arduino version: %s", v);
		this.emit('version', v);
		if (v.arduinoModel == 'V12') {
			var rfDevice = { G : "0"	
					, V : 0
					, D : 11
					};
              		this.savePersistantDevice(rfDevice);
			var ninaEyes = { G : "0"	
					, V : 0
					, D : 1007
					};
                	this.savePersistantDevice(ninaEyes);
		}
	}

};
