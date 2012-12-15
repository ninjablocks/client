var
	path = require('path')
	, util = require('util')
	, upnode = require('upnode')
	, logger = require(path.resolve(__dirname, '..', '..', 'lib', 'logger'))
	, stream = require('stream')
	, tls = require('tls')
	, net = require('net')
	, fs = require('fs')
;

function client(opts, credentials, app) {

	var
		modules = {}
	;

	if((!credentials) || !credentials.id) {

		app.log.error("Invalid credentials specified.");
		return false;
	}
	if(!opts || opts == {}) {

		app.log.error("Invalid opts object provided.");
		return false;
	}

	stream.call(this);

	this.opts = opts || undefined;
	this.log = app.log;
	this.credentials = credentials;

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

client.prototype.block = require('./block')

client.prototype.handlers = {

	revokeCredentials : function revokeCredentials() {

		this.log.info('Invalid token, restarting.');
		this.emit('client::invalidToken', true);
		// invalidate token
		process.exit(1);	
	}
	, execute : function execute(cmd, cb) {

		// execute command
	}
	, update : function update(to) {

		// update client
	}
};

client.prototype.connect = function connect() {

	var client = this;
	this.node = upnode(this.handlers).connect(this.parameters);

	this.node.on('up', client.up.bind(client));

	this.node.on('reconnect', client.reconnect.bind(client));
};

client.prototype.up = function up() {

	this.emit('client::up', true);
	this.log.info("Client connected to cloud.");
};

client.prototype.down = function down() {

	this.emit('client::down', true);
	this.log.info("Client disconnected from cloud.");
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
