var
	path = require('path')
	, util = require('util')
	, upnode = require('upnode')
	, creds = require(path.resolve(__dirname, '..', '..', 'lib', 'credentials'))
	, logger = require(path.resolve(__dirname, '..', '..', 'lib', 'logger'))
	, stream = require('stream')
	, tls = require('tls')
	, net = require('net')
	, fs = require('fs')
;

function client(opts, app) {

	var
		modules = {}
	;

	if(!opts || opts == {}) {

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
	this.log = app.log;
	creds.call(this);

	this.addModule = function addModule(name, params, mod, app) {

		var newModule = new mod(params, app);

		if(!modules[name]) { modules[name] = {}; }

		modules[name][params.id] = newModule;
		newModule.on('error', this.moduleError.bind(newModule));

		return modules[name][params.id];
	};

	this.moduleError = function moduleError(err) {

		this.log.error("Module error: %s", err);
	};

	this.node = undefined; // upnode
	this.transport = opts.secure ? tls : net;
	this.parameters = this.getParameters.call(this, opts);
};

util.inherits(client, stream);

client.prototype.block = require('./block');

client.prototype.getHandlers = function() {

	return {

		revokeCredentials : function revokeCredentials() {

			this.log.info('Invalid token');
			this.emit('client::invalidToken', true);

		}.bind(this)
		, execute : function execute(cmd, cb) {

			console.log("Command request: %s", cmd);
			// execute command
		}.bind(this)
		, update : function update(to) {

			// update client
		}.bind(this)
	}
};

client.prototype.connect = function connect() {

	var client = this;
	this.node = upnode(this.getHandlers()).connect(this.parameters);

	this.node.on('reconnect', client.reconnect.bind(client));
	this.node.on('up', client.up.bind(client));
	this.initialize();
};

/**
 * Initialize the session with the cloud after a connection
 * has been established. 
 */
 
client.prototype.initialize = function initialize() {

	var 
		flushBuffer = function flushBuffer() {

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

			this.cloud = cloud;
	 		
			if(this.pulse) { clearInterval(this.pulse) }
			this.pulse = setInterval(beat, 5000);
			flushBuffer.call(this);
		}
	;

	this.on('client::authed', initSession);
};

client.prototype.up = function up() {

	this.emit('client::up', true);
	this.log.info("Client connected to cloud");
};

client.prototype.down = function down() {

	this.emit('client::down', true);
	this.log.info("Client disconnected from cloud");
};

client.prototype.reconnect = function reconnect() {

	this.emit('client::reconnecting', true);
	this.log.info("Connecting to cloud...");
};

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

client.prototype.loadModule = function loadModule(name, opts, app) {

	if(!name) {

		this.log.error("loadModule error: invalid module name");
		return false;
	}

	try {

		var 
			file = path.resolve(__dirname, 'ninja_modules', name)
		;

		if(fs.existsSync(file)) {

			var mod = require(file);
		}
		else {

			this.log.error("loadModule error: No such module '%s'", name);
			return null;
		}
	}
	catch(e) {

		this.log.error("loadModule error: %s", e);
		return false;
	}

	this.log.info("loadModule success: %s", name);
	return this.addModule(name, opts, mod, app);
};

module.exports = client;
