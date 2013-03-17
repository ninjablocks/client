var
	path = require('path')
	, mkdirp = require('mkdirp')
	, util = require('util')
	, fs = require('fs')
	, domain = require('domain')
;

module.exports = moduleHandlers;

function moduleHandlers(client) {

	client.prototype.loadModule = function loadModule(name, opts, app, cb) {

		if(!name) {

			this.log.error("loadModule: invalid module name");
			return cb("Invalid module name", null);
		}
		cb = cb || function() {};
		try {

			var
				file = path.resolve(

					process.cwd()
					, 'drivers'
					, name
				)
			;

			if(existsSync(file)) {

				var mod = require(file);
				mod.prototype.opts = opts;
				// stub save function for handling save reqs on instantiation
				mod.prototype.save = function(cfg) {

					this.queuedSave = cfg || this.opts ? this.opts : { };
				};
			}
			else {

				this.log.error("loadModule: No such module '%s'", name);
				cb(Error(util.format("No such module (%s)", name)), null);
				return;
			}
		}
		catch(e) {
			this.log.error("loadModule: %s (%s)", e, name);
			return cb(e, null);
		}

		this.addModule(name, opts, mod, app, cb);
	};


	client.prototype.addModule = function addModule(name, params, mod, app, cb) {

		if(!mod) {
			var err = new Error('Invalid module provided');
			this.log.error(err);
			return cb(err, null);
		}

		this.log.info("loadModule: %s", name);


		var d = domain.create();

		d.on('error', function(err) {

			this.log.error(

				'(%s) had the following error:\n\n%s\n'
				, name
				, err.stack
			);
		}.bind(this));

		d.run(function() {

			var 
				version = this.versionMethod(name, mod)
				, newModule = new mod(params, app, version)
			;
			this.bindModule(newModule, name);
			this.modules[name] = newModule;

			cb(null, newModule);

		}.bind(this));
	};

	client.prototype.bindModule = function bindModule(mod, name) {

		var ninja = this;

		mod.log = this.log;
		mod.save = function emitSave(conf) {

			this.emit('save', conf || mod.opts ? mod.opts : { });

		}.bind(mod);
		mod.on('announcement', this.announcementHandler.call(ninja, mod, name));
		mod.on('register', this.registerHandler.call(ninja, name));
		mod.on('config', this.configHandler.call(ninja, mod, name));
		mod.on('error', this.moduleError.bind(mod));
		mod.on('save', this.saveHandler.call(mod, name));
		mod.on('ack', this.ackHandler.call(ninja, name));
		mod.on('data', function(dat) {

			//this.dataHandler.call(this, mod)
			ninja.sendData(dat);
		});
		if(mod.queuedSave) {

			process.nextTick(function() {

				var dat = mod.queuedSave;
				mod.queuedSave = undefined;
				mod.emit('save', dat);
			});
		}
		// set data handlers after registration
	};

	/**
	 * Called when a module emits a config event
	 */
	client.prototype.configHandler = function configHandler(mod, name) {

		var
			ninja = this
			, name = name || undefined
		;

		return function requestConfig(params) {

			if(!name) {

				return ninja.log.error("configHandler: Unknown module");
			}
			var req;
			if(params.type == "MODULE") {

				req = moduleConfigRequest(params);
				if(ninja.cloud) {

					var req = moduleConfigRequest(params);
					ninja.cloud.config(req);
				}
			}
			else if(params.type == "PLUGIN") {

				ninja.sendConfig(params);
			}

			function moduleConfigRequest(params) {

				return {

					type : params.type || "MODULE"
					, module : name
					, data : params || { }
				}
			};

			/**
			 * Not currently used
			 */
			function optionsResults(err, dat) {

				if(err) {

					if(err.code == "ENOENT") {

						ninja.log.error(

							"requestConfig: module has no options! (%s)"
							, name
						);
						return;
					}
					ninja.log.error("requestConfig: %s (%s)", err, name);
					return;
				}
				options = JSON.stringify({ options : dat }) || undefined;
				if(!options) {

					ninja.log.error("requestConfig: invalid JSON (%s)", name);
					return;
				}
				ninja.log.debug("requestConfig: sending request (%s)", name);
				/**
				 * Send the cloud a config request with
				 * the available options and current settings (if any)
				 */
				ninja.cloud.config(configRequest);
			};
		};
	};

	client.prototype.announcementHandler = function(mod, name) {

		var
			ninja = this
			, name = name || undefined
		;

		return function requestAnnouncement(dat) {

			if(!name) {

				return ninja.log.error("configHandler: Unknown module");
			}

			var announcementRequest = {

				CONFIG : [{

					type : 'MODULE_ANNOUNCEMENT'
					, module : name
				  	, data : dat
				}]
			};

			ninja.cloud.config(announcementRequest);
			ninja.log.debug("requestAnnouncement: sending request (%s)", name);
		};
	};

	client.prototype.saveHandler = function saveHandler(name) {

		var mod = this;
		return function saveConfig(conf) {

			var
				conf = conf || { }
				, file = path.resolve(

					process.cwd()
					, 'config'
					, name
					, 'config.json'
				)
				, data = null
			;

			if(!conf) {

				mod.log.debug("saveConfig: No config to save (%s)", name);
				return false;
			}

			data = JSON.stringify({ config : conf }, null, '\t');
			if(!data) {

				mod.log.debug("saveConfig: No JSON parsed (%s)", name);
				return false;
			}

			this.log.debug("saveConfig: writing config (%s)", file);

			mkdirp(path.dirname(file), ready);

			function ready(err) {

				if(err) {

					return mod.log.error(

						"saveConfig: directory error: %s (%s)"
						, err
						, path.dirname(file)
					);
				}
				fs.writeFile(file, data, done);

			};

			function done(err) {

				if(err) {

					return mod.log.error("saveConfig: write failure (%s)", name);
				}
				mod.log.debug("saveConfig: great success! (%s)", name);
			};

			return true;

		}.bind(this);
	};

	client.prototype.ackHandler = function(name) {

		var ninja = this;
		return function(dat) {

			//ninja.log.debug("ackHandler: (%s)", name);
			if(!dat) { return; }
			ninja.sendData(dat);
		};
	};

	client.prototype.registerHandler = function registerHandler(name) {

		var ninja = this;
		return function(device) {

			if (ninja.devices.hasOwnProperty(device.guid)) {
				ninja.log.info('Duplicate device handler ignored (%s)',device.guid);
				return;
			}

			device.guid = ninja.getGuid(device);
			device.module = name || undefined;
			device.on('data', ninja.dataHandler.call(ninja, device));
			device.on('error', ninja.errorHandler.call(ninja, device))
			ninja.log.debug("Registering device %s", device.guid);
			ninja.devices[device.guid] = device;
			ninja.app.emit("device::up", device.guid);
		};
	};

	client.prototype.errorHandler = function(device) {

		var self = this;
		return function(err) {

			self.log.error("device: %s", err);
			if(device.unregister) {

				process.nextTick(device.unregister);
			}
			self.emit("device::down", device);
		}
	};

	client.prototype.moduleError = function moduleError(err) {

		this.log.error("Module error: %s", err);
	};

	client.prototype.moduleHandlers = {

		config : require('./config')
		, install : require('./install')
		, uninstall : require('./uninstall')

	};


};

function existsSync(file) {

	if(fs.existsSync) { return fs.existsSync(file); }
	return path.existsSync(file);
};
