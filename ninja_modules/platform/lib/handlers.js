var deviceMeta = require('./meta-props');

module.exports = deviceHandlers;

function deviceHandlers(platform) {

	platform.prototype.dataEvent = function dataEvent(type, dat) {

		var mod = this;
		var trigger = {

			'ACK' : function(dat) {

				mod.ackHandler(dat.ACK || null);
			}
			, 'DEVICE' : function(dat) {

				mod.deviceHandler(dat);
			}
			, 'PLUGIN' : function(dat) {

				mod.pluginHandler(dat);
				mod.log.debug("Device plugin:");
				console.log(dat)
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

	platform.prototype.ackHandler = function(dataset) {

		var mod = this;
		if(!(dataset) || !dataset.ACK instanceof Array) { return; }

		dataset.ACK.map(function(ack) {

			mod.emit("ack", ack);
		});
	};
};
