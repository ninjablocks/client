var 
	mkdirp = require('mkdirp')
	, path = require('path')
	, fs = require('fs')
;

/**
 * TODO: configuration profiles
 */

module.exports = function config(ninja, app) {


	if((!ninja) || !ninja.opts) {

		return false;
	}
	// default arduino device path	
	if(!ninja.opts.client || ninja.opts.client == 'beagle') {

		ninja.opts.device = '/dev/ttyO1';
	}

	loadPlatform(ninja, app); // embedded arduino
	
	var 
		modPath = path.resolve(process.cwd(), 'ninja_modules')
		, read = function read() {

			fs.readdir(modPath, load);
		}
		, load = function load(err, mods) {

			if(err) {

				return app.log.error("config: Error loading modules (%s)", err);
			}

			mods
				.filter(embedded)
				.map(create)
			;
		}
		, create = function create(mod) {

			config(mod, launch);
		}
		, launch = function launch(mod, conf) {

			if(!conf) {

				ninja.log.error("config: Unable to load config (%s)", mod);
				return;
			}
			ninja.loadModule(

				mod
				, conf
				, app
			);
		}
		, config = function config(mod, cb) {

			 var 
			 	conf = path.resolve(

				 	process.cwd()
				 	, 'config'
				 	, mod
				 	, 'config.json'
				)
				, emit = function(err, dat) {

					if(err) {

						if(err.code == "ENOENT") {

							return app.log.info("config: No file (%s)", mod);
						}
						app.log.error("config: %s (%s)", err, mod);
						return cb(mod, null);
					}
					var parsed = ninja.getJSON(dat);

					if(!parsed.config) {

						return app.log.error("config: Bad config (%s)", mod);
					}
					cb(mod, parsed.config);
				}
			;
			fs.readFile(conf, emit);
		}
		, embedded = function embedded(mod) {

			// TODO: make this better than a horrible ternary
			return mod == "serial" ? false : mod == "platform" ? false : true
		}
	;

	mkdirp(modPath, read);

	ninja.emit('loaded'); // done loading modules
	ninja.connect();

	return ninja;
};

/**
 * Load ninja cape & arduino modules if present
 * at the moment these modules rely on a proper load order
 * TODO: fix this so they can load asynchronously.
 */
function loadPlatform(ninja, app) {

	if(ninja.opts.device) {

		// arduino controller
		ninja.loadModule(

			'platform'
			, { id : 'arduino' }
			, app
		);

		// serial device
		ninja.loadModule(

			'serial'
			, { device : ninja.opts.device, id : 'arduino' }
			, app
		);
	}
};