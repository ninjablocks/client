var
	upnode = require('upnode')
	, path = require('path')
	, logger = require(path.resolve(__dirname, '..', 'lib', 'logger'))
	, tls = require('tls')
	, net = require('net')
	, log
;

function client(opts, credentials) {

	log = logger.default;

	if((!credentials) || !credentials.id) {

		log.error('Unable to create client, no serial (ID) specified.');
		return false;
	}

	this.opts = opts || {};
	this.node = undefined;
	this.transport = opts.secure ? tls : net;
};

client.prototype.handlers = {

	revokeCredentials : function revokeCredentials() {

		log.info('Invalid token, restarting.');
		
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
	this.node.on('reconnect', this.reconnect)
};

client.prototype.up = function up() {

	this.emit('up');
	log.info("Client connected to cloud.");
};

client.prototype.down = function down() {

	this.emit('down');
	log.info("Client disconnected from cloud.");
};

client.prototype.reconnect = function reconnect() {

	this.emit('reconnect');
	log.info("Reconnecting to cloud...");
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
		params = {

			client : opts.client || 'beagle'
			, id : opts.id
			, version : {

				// node, arduino, utilities & system versions
			}
		}
		, token = this.credentials.token || undefined
	;

	if(token) {

		remote.handshake(params, token, function handshake(err, res) {

			if(err) {

				log.error("Error in remote handshake: %s", err);
				return;
			}
			conn.emit('up', res);
			this.emit('authed', res);
		});
	}
	else {

		this.emit('readyActivate', res);
		log.info("Ready to be activated.");

		// activate
	}
};

module.exports = client;
