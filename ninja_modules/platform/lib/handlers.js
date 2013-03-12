var deviceMeta = require('./meta-props');

module.exports = deviceHandlers;

function deviceHandlers(platform) {

	platform.prototype.dataEvent = function dataEvent(type, dat) {

		var mod = this;
		var trigger = {

			'ACK' : function(dat) {

				mod.ackHandler(dat || null);
			}
			, 'DEVICE' : function(dat) {

				mod.deviceHandler(dat);
			}
			, 'PLUGIN' : function(dat) {

				mod.pluginHandler(dat);
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

			if(device.D !== 2) {

				mod.log.debug(

					"platform: Device data \"%s\" (%s)"
					, device.DA
					, device.D
				);
			}

			if(deviceMeta[device.V][device.D]) {

				var meta = deviceMeta[device.V][device.D];
				if(mod[meta.method]) {

					mod[meta.method](device, meta);
				}
				else {

					/**
					 * Device with meta data but no methods
					 */
					if(meta.debounceCommands && meta.debounceTimeout && !device.DEBOUNCED) {

						return mod.debounceCommand(device, meta.debounceTimeout);
					}
					if(meta.queueCommands) {

						return mod.queueCommand(device);
					}
					mod.sendData(device);
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

			mod.log.debug("platform: Device plugged in (%s)", device.GUID);
			mod.sendConfig("PLUGIN", device);
		});
	};

	platform.prototype.ackHandler = function(dataset) {

		var mod = this;
		if(!(dataset) || !dataset instanceof Array) { return; }

		dataset.map(function(ack) {
		
			mod.emit("ack", ack);
		});
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

	platform.prototype.onCommand = function onCommand(dat) {

		var mod = this;
		if(!dat) { return; }

		mod.log.debug("platform: Command sent to %s", dat.GUID);
		if(deviceMeta[dat.V][dat.D]) {

			var meta = deviceMeta[dat.V][dat.D];
			if(meta.debounce === true && meta.debounceTimeout) {

				return mod.debounceCommand(dat);
			}
			if(meta.queueCommands === true) {

				return mod.queueCommand(dat);
			}
		}
		// write directly to device
	};
};
