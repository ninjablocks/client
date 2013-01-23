var
	path = require('path')
	, util = require('util')
	, mkdirp = require('mkdirp')
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
	this.modules = { };
	this.devices = { };
	this.log = app.log;
	creds.call(this);

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
			this.app.emit('client::invalidToken', true);

		}.bind(this)
		, execute : function execute(cmd, cb) {

			console.log("Command request: %s", cmd);
			this.command(cmd);

		}.bind(this)
		, update : function update(to) {

			// update client
		}.bind(this)
		, config : function config(dat, cb) {

			// configure module/device
		}
		, install : function install(mod, cb) {

			// install module
		}.bind(this)
		, uninstall : function uninstall(mod, cb) {

			// uninstall module
		}.bind(this)
	}
};

/**
 * Connect the block to the cloud
 */
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

			this.cloud = cloud;
	 		
			if(this.pulse) { clearInterval(this.pulse); }
			this.pulse = setInterval(beat.bind(this), 5000);
			flushBuffer.call(this);
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

	this.app.emit('client::up', cloud);
	this.log.info("Client connected to cloud");
};

client.prototype.down = function down() {

	this.app.emit('client::down', true);
	this.log.info("Client disconnected from cloud");
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

client.prototype.registerDevice = function registerDevice(device) {

	if(!device) { return; }

	device.guid = this.getGuid(device);
	device.on('data', this.dataHandler.call(this, device));
	this.log.debug("Registering device %s", device.guid);
	this.devices[device.guid] = device;
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
		}
	}
};

client.prototype.sendData = function sendData(dat) {
		
	if(!dat) { return false; }

	dat.GUID = this.getGuid(dat);
	dat.TIMESTAMP = (new Date().getTime());

	if((this.app.cloud) && this.app.cloud.data) {

		var msg = { 'DEVICE' : [ dat ] };
		return this.app.cloud.data(msg);
	}

	this.bufferData(msg);
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

		console.log("Executing: ");
		console.log(ds[d]);

		var 
			guid = ds[d].GUID
			, device
		;
		delete ds[d].GUID;

		ds[d].G = ds[d].G.toString();

		if((device = this.devices[guid]) && typeof device.write == "function") {

			try {

				return this.devices[guid].write(ds[d].DA);
			}
			catch(e) {

				this.log.error("error actuating: %s (%s)", guid, err.message);
			}
		}
		else {

			this.log.debug("actuating %s (%s)", guid, ds[d].DA);
			// write to TTY
		}
	}
};

/**
 * Initiate module loading sequence...
 */
client.prototype.loadModule = function loadModule(name, opts, app) {

	if(!name) {

		this.log.error("loadModule error: invalid module name");
		return false;
	}

	try {

		var 
			file = path.resolve(

				process.cwd()
				, 'ninja_modules'
				, name
			)
		;

		if(existsSync(file)) {

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

	return this.addModule(name, opts, mod, app);
};


client.prototype.addModule = function addModule(name, params, mod, app) {

	if(!mod) { 

		this.log.error(new Error('Invalid module provided'));
		return false; 
	}

	var newModule = new mod(params, app);

	this.log.info("loadModule success: %s", name);
	if(!this.modules[name]) { this.modules[name] = {}; }

	this.modules[name][params.id] = newModule;
	this.bindModule(newModule, name);

	return this.modules[name][params.id];
};

client.prototype.bindModule = function bindModule(mod, name) {
	
	mod.save = function emitSave() { this.emit('save'); }.bind(mod);

	mod.on('register', this.registerDevice.bind(this));
	mod.on('error', this.moduleError.bind(mod));
	mod.on('save', this.saveHandler.call(this, name, mod));
	// set data handlers after registration
};

client.prototype.saveHandler = function saveHandler(name, mod) {
	
	return function saveConfig() {

		var 
			conf = mod.config || null
			, file = path.resolve(

				process.cwd()
				, 'config'
				, name
				, 'config.json'
			)
			, data = null
		;

		if(!conf) { 

			this.log.debug("saveConfig: No config to save (%s)", name);
			return false;
		}

		data = JSON.stringify({ config : conf }, null, '\t');

		if(!data) {

			this.log.debug("saveConfig: No JSON parsed (%s)", name);
			return false;
		}

		this.log.debug("saveConfig: writing config (%s)", file);

		mkdirp(path.dirname(file), ready);

		function ready(err) {

			if(err) {

				return this.log.error(

					"saveConfig: directory error: %s (%s)"
					, err
					, path.dirname(file)
				);
			}			
			fs.writeFile(file, data, done);
		};

		function done(err) {

			if(err) {

				return this.log.error("saveConfig: write failure (%s)", name);
			}
			this.log.debug("saveConfig: great success! (%s)", name);
		};

		return true;
	}.bind(this);
};

client.prototype.moduleError = function moduleError(err) {

	this.log.error("Module error: %s", err);
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

		return JSON.parse(dat);
	}
	catch(e) {

		this.log.debug('Invalid JSON: %s', e);
		return false;
	}
};

function existsSync(file) {

	if(fs.existsSync) { return fs.existsSync(file); }
	return path.existsSync(file);
};


module.exports = client;
