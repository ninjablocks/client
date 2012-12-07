var
	path = require('path')
	, util = require('util')
	, upnode = require('upnode')
	, logger = require(path.resolve(__dirname, '..', 'lib', 'logger'))
	, stream = require('stream')
	, tls = require('tls')
	, net = require('net')
	, fs = require('fs')
;

function client(opts, credentials, app) {

	var
		modules = {}
	;

	stream.call(this);

	this.log = app.log;

/** waiting for credentials abstraction

	if((!credentials) || !credentials.id) {

		app.log.error('Unable to create client, no ninja serial specified.');
		return false;
	}
*/
	this.addModule = function addModule(name, opts, mod, app) {

		var newModule = new mod(opts, app);

		if(!modules[name]) { modules[name] = {}; }

		modules[name][opts.id] = newModule;
		newModule.on('error', this.moduleError.bind(newModule));

		return modules[name][opts.id];
	};

	this.moduleError = function moduleError(err) {

		this.log.error("Module error: %s", err);
	};

	this.opts = opts || {};
	this.node = undefined; // upnode
	this.parameters = this.getParameters(opts);
	this.transport = opts.secure ? tls : net;
};

util.inherits(client, stream);

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

	var client = this;
	this.node = upnode(this.handlers).connect(this.parameters);

	this.node.on('up', client.up.bind(client));

	this.node.on('reconnect', client.reconnect.bind(client));
};

client.prototype.up = function up() {

	console.log(this);
	this.emit('device::up', true);
	this.log.info("Client connected to cloud.");
};

client.prototype.down = function down() {

	this.emit('device::down', true);
	this.log.info("Client disconnected from cloud.");
};

client.prototype.reconnect = function reconnect() {

	this.emit('device::reconnecting', true);
	this.log.info("Connecting to cloud...");
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
		, handshake = function handshake(err, res) {

			if(err) {

				this.log.error("Error in remote handshake: %s", err);
				return;
			}

			conn.emit('up', res);
			this.emit('device::authed', res);

		}.bind(this)
	;

	if(token) {

		remote.handshake(params, token, handshake);
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
