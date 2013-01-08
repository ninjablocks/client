/**
 * Ninja Blocks arduino controller
 */

function platform(opts, app) {
	
	this.app = app;

	this.newDevice = function newDevice(dev) {

		if(dev.id != 'arduino') { return; }

		app.log.debug("Initializing arduino...");

		dev.on('open', this.onOpen);
		dev.on('close', this.onClose);
		dev.on('error', this.onError);
		dev.on('data', this.onData);

	};

	this.onData = function onData(data) {

		var json = 
	};

	app.on('serial::new', this.newDevice);

};

platform.prototype.getJSON = function getJSON(data) {
	
	try {

		return JSON.parse(chunk);
	}	
	catch (e) {

		this.app.debug("Ignoring invalid JSON (%s)", data);
	}
};

module.exports = platform;
