var
	path = require('path')
	, util = require('util')
	, mkdirp = require('mkdirp')
	, upnode = require('upnode')
	, handlers = require('./module/handlers')
	, stream = require('stream')
	, tls = require('tls')
	, net = require('net')
	, fs = require('fs')
	, existsSync = fs.existsSync || path.existsSync
	, versioning = require(path.resolve(
		__dirname, '..', '..', 'lib', 'versioning'
	))
	, creds = require(path.resolve(
		__dirname, '..', '..', 'lib', 'credentials'
	))
	, logger = require(path.resolve(
		__dirname, '..', '..', 'lib', 'logger'
	))
;

function client(opts, app) {

	var
		modules = {}
		, mod = this;
	;

	if(!opts || Object.keys(opts).length === 0) {

		app.log.error("Invalid opts object provided");
		return false;
	}

	if(!creds || typeof creds !== 'function') {

		app.log.error("Invalid credential provider specified");
		return false;
	}


	stream.call(this);

	this.app = app;
	this.opts = opts || undefined;
	this.sendBuffer = [ ];
	this.modules = { };
	this.devices = { };
	this.log = app.log;
	creds.call(this, opts);
	versioning.call(this, opts);

	this.node = undefined; // upnode
	this.transport = opts.secure ? tls : net;
	this.parameters = this.getParameters.call(this, opts);

	this.versionClient();
};

util.inherits(client, stream);
handlers(client);

client.prototype.block = require('./block');

client.prototype.getHandlers = function() {

	return {

		revokeCredentials : function revokeCredentials() {

			this.log.info('Invalid token');
			this.app.emit('client::invalidToken', true);

		}.bind(this)
		, execute : function execute(cmd, cb) {

			// console.log("Command request: %s", cmd);
			this.command(cmd);

		}.bind(this)
		, update : function update(to) {

			// update client
		}.bind(this)
		, config : this.moduleHandlers.config.bind(this)
		, install : this.moduleHandlers.install.bind(this)
		, uninstall : this.moduleHandlers.uninstall.bind(this)
	}
};

/**
 * Connect the block to the cloud
 */
client.prototype.connect = function connect() {
	
	var client = this;
	this.node = upnode(this.getHandlers()).connect(this.parameters);
	this.node.on('reconnect', client.reconnect.bind(client));
	this.node.on('down', client.down.bind(client));
	this.node.on('up', client.up.bind(client));
	this.initialize();
};

/**
 * Initialize the session with the cloud after a connection
 * has been established.
 */
client.prototype.initialize = function initialize() {

	var
		mod = this
		, flushBuffer = function flushBuffer() {

			if(!this.sendBuffer) { this.sendBuffer = [ ]; return; }
			if(this.sendBuffer.length > 0) {

				this.log.debug("Sending buffered commands...");
				this.cloud.data({

					'DEVICE' : this.sendBuffer
				});
				this.sendBuffer = [ ];
			}
			else {

				this.log.debug("No buffered commands to send");
			}
		}
		, initSession = function initSession(cloud) {

			mod.cloud = cloud;

			if(mod.pulse) { clearInterval(mod.pulse); }
			mod.pulse = setInterval(beat.bind(mod), 5000);
			flushBuffer.call(mod);
		}
		, beat = function beat() {

			// this.log.debug("Sending heartbeat");
			this.cloud.heartbeat(JSON.stringify({

				"TIMESTAMP" : (new Date().getTime())
				, "DEVICE" : [ ]

			}));
		}
	;

	this.app.on('client::up', initSession);
};

/**
 * cloud event handlers
 */
client.prototype.up = function up(cloud) {

	try {

		this.app.emit('client::up', cloud);
	} catch(err) {

		this.log.error('An unknown module had the following error:\n\n%s\n', err.stack);
	}

	this.log.info("Client connected to the Ninja Platform");
};

client.prototype.down = function down() {

	this.app.emit('client::down', true);
	this.log.info("Client disconnected from the Ninja Platform");
	if(this.pulse) {

		clearInterval(this.pulse);
	}
};

client.prototype.reconnect = function reconnect() {

	this.app.emit('client::reconnecting', true);

	this.log.info("Connecting to cloud...");
};

/**
 * Generate scoped parameters for dnode connection
 */
client.prototype.getParameters = function getParameters(opts) {

	var
		cloudPort = this.opts.cloudPort
		, cloudHost = this.opts.cloudHost
		, transport = this.transport
	;

	return {

		ping : 10000
		, timeout : 5000
		, reconnect : 2000
		, createStream : function createStream() {

			return transport.connect(cloudPort, cloudHost);
		}
		, block : this.block.bind(this)
	};
};

client.prototype.dataHandler = function dataHandler(device) {

	var self = this;
	return function(data) {

		try {

			self.sendData({

				G : device.G
				, V : device.V
				, D : device.D
				, DA : data
			});
		}
		catch(e) {

			self.log.debug("Error sending data (%s)", self.getGuid(device));
			self.log.error(e);
		}
	}
};

client.prototype.sendData = function sendData(dat) {

	if(!dat) { return false; }

	dat.GUID = this.getGuid(dat);
	dat.TIMESTAMP = (new Date().getTime());
	var msg = { 'DEVICE' : [ dat ] };

	if((this.cloud) && this.cloud.data) {

		return this.cloud.data(msg);
	}

	this.bufferData(msg);
};

client.prototype.sendConfig = function sendConfig(dat) {

	if(!dat) { return false; }

	dat.GUID = this.getGuid(dat);
	dat.TIMESTAMP = (new Date().getTime());
	if((this.cloud) && this.cloud.config) {

		return this.cloud.config(JSON.stringify(dat));
	}
};

client.prototype.bufferData = function bufferData(msg) {

	this.sendBuffer.push(msg);

	if(this.sendBuffer.length > 9) {

		this.sendBuffer.shift();
	}
};

client.prototype.command = function command(dat) {

	var
		self = this
		, data = this.getJSON(dat)
	;

	for(var d = 0, ds = data.DEVICE; d < ds.length; d++) {

		// console.log("Executing: ");
		// console.log(ds[d]);

		var
			guid = ds[d].GUID
			, device
		;
		// delete ds[d].GUID;

		ds[d].G = ds[d].G.toString();

		if((device = this.devices[guid]) && typeof device.write == "function") {

			try {

				this.devices[guid].write(ds[d].DA);
				return true;
			}
			catch(e) {

				this.log.error("error actuating: %s (%s)", guid, err.message);
			}
		}
		else {

			// most likely an arduino device (or a bad module)
			this.log.debug("actuating %s (%s)", guid, ds[d].DA);
			this.app.emit('device::command', ds[d]);
		}
	}
};

client.prototype.getGuid = function getGuid(device) {

	return [

		this.serial
		, device.G
		, device.V
		, device.D

	].join('_');
};

client.prototype.getJSON = function getJSON(dat) {

	try {
		if(dat instanceof Buffer) { dat = dat.toString(); }
		return JSON.parse(dat);
	}
	catch(e) {

		this.log.debug('Invalid JSON: %s', e);
		return false;
	}
};

module.exports = client;
