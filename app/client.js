var
	upnode = require('upnode')
	, path = require('path')
	, logger = require(path.resolve(__dirname, '..', 'lib', 'logger'))
	, tls = require('tls')
	, net = require('net')
	, fs = require('fs')
;

function client(opts, credentials, app) {

	var
		modules = {}
	;

	this.log = app.log;

/** waiting for credentials abstraction
	if((!credentials) || !credentials.id) {

		app.log.error('Unable to create client, no ninja serial specified.');
		return false;
	}
*/
	this.addModule = function addModule(name, opts, mod, app) {

		if(!modules[name]) { modules[name] = {}; }
		modules[name][opts.id] = new mod(opts, app);

		return modules[name][opts.id];
	};

	this.opts = opts || {};
	this.node = undefined; // upnode
	this.parameters = this.getParameters(opts);
	this.transport = opts.secure ? tls : net;
};

client.prototype.handlers = {

	revokeCredentials : function revokeCredentials() {

		this.log.info('Invalid token, restarting.');
		this.emit('device::invalidToken', true);
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

	this.node = upnode(this.handlers).connect(this.parameters);

	this.node.on('up', this.up);
	this.node.on('reconnect', this.reconnect);
};

client.prototype.up = function up() {

	this.emit('device::up', true);
	this.log.info("Client connected to cloud.");
};

client.prototype.down = function down() {

	this.emit('device::down', true);
	this.log.info("Client disconnected from cloud.");
};

client.prototype.reconnect = function reconnect() {

	this.emit('device::reconnecting', true);
	this.log.info("Reconnecting to cloud...");
};

client.prototype.getParameters = function getParameters(opts) {

	var parameters = {

		ping : 10000
		, timeout : 5000
		, reconnect : 2000
		, createStream : function createStream() {

			return this.transport.connect(

				this.opts.cloudPort
				, this.opts.cloudHost
			)
		}
		, block : this.block
	};
};

client.prototype.block = function block(remote, conn) {

	var 
		token = this.credentials.token || undefined
		, params = {

			//TODO: better client default/detection?
			client : opts.client || 'beagle'
			, id : opts.id
			, version : {

				// node, arduino, utilities & system versions
			}
		}
	;

	if(token) {

		remote.handshake(params, token, function handshake(err, res) {

			if(err) {

				this.log.error("Error in remote handshake: %s", err);
				return;
			}
			conn.emit('up', res);
			this.emit('device::authed', res);
		});
	}
	else {

		this.emit('device::needsActivation', res);
		this.log.info("Ready to be activated.");

		// activate
	}
};

client.prototype.loadModule = function loadModule(name, opts, app) {

	if(!name) {

		this.log.error("loadModule error: invalid module name");
		return false;
	}

	try {

		var mod = require(path.resolve(__dirname, 'ninja_modules', name))
	}
	catch(e) {

		this.log.error("loadModule error: %s", e);
		return false;
	}

	this.log.info("loadModule success: %s", name);
	return this.addModule(name, opts, mod, app);
};

module.exports = client;
