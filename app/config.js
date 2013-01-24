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

			mods.map(function(mod) {

				ninja.loadModule(

					mod
					, config(mod)
					, app
				);
			});
		}
		, config = function config(mod) {

			/**		
			 * get config file for module
			 * either config/<mod>/config.json
			 * or (default) config parameter from its package.json
			 */
			 return { };
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