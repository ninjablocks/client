module.exports = metaEvents;

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

			var guid = dat.GUID || undefined;

			delete dat.GUID;
			if(!guid) { return; }

			timeout = setTimeout(function queueTimeout() {

				mod.log.info(

					"platform: Queued write timeout (%s:%s)"
					, guid
					, dat.DA || "???"
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

	platform.prototype.debounceCommand = function debounceCommand(device, timeout) {

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
		this.sendData(device);
	};

	platform.prototype.arduinoVersion = function arduinoVersion(dat) {

		this.log.debug("platform: arduino version: %s", dat);
		this.emit('version', dat);
	};
};
