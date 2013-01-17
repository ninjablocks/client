/**
 * Deprecated at the moment
 */

function heartbeat() {

	var beat = getBeat.call(this);
	this.cloud.heartbeat(beat);
	this.log.debug("Sending heartbeat...");
};

function getBeat() {

	var beat = {

		'TIMESTAMP' : (new Date().getTime())
		, 'DEVICE' : [ ]
	};

	for (r in this.readings) {

		if(this.readings.hasOwnProperty(r)) {

			hb.DEVICE.unshift(this.readings[r]);
		}
	}
	this.readings = { };

	return JSON.stringify(beat);
}

module.exports = heartbeat;
