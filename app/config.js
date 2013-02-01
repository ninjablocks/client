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

	// TODO: refactor this hack
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

						// no config/module/config.json
						if(err.code == "ENOENT") {

							// create one (from package.json if exists)
							return init(mod, cb);
						}
						// other error (parsing)
						app.log.error("config: %s (%s)", err, mod);
						return cb(mod, null);
					}
					
					var parsed = ninja.getJSON(dat);
					if(!parsed.config) {

						cb(mod, null)
						return app.log.info("config: no config (%s)", mod);
					}
					cb(mod, parsed.config);
				}
				, init = function(mod, cb) {

					var
						pkg = path.resolve(

							process.cwd()
							, 'ninja_modules'
							, mod
							, 'package.json'
						)
						, parse = function(err, dat) {

							if(err) {

								if(err.code == "ENOENT") {

									cb(mod, { });
									return app.log.info("config: No package file (%s)", mod);
								}
								return app.log.error("config: %s (%s)", err, mod);
							}

							// fs.writeFile()/
							var parsed = ninja.getJSON(dat);
							if((!parsed) || !parsed.config) {

								return app.log.info("config: No package (%s)", mod);
							}

							mkdirp(path.dirname(conf), function(err) {

								if(err) {

									return app.log.error("config: Unable to create directory (%s)", path.dirname(conf));
								}
								fs.writeFile(

									conf
									, JSON.stringify({ config : parsed.config }, null, "\t")
									, function(err) {

										if(err) {

											return app.log.error("config: Unable to write (%s)", mod);
										}

										app.log.debug("config: Created file (%s)", mod);
										cb(mod, parsed.config);
									}
								);
							});
						}
					;

					fs.exists(pkg, function(bool) {

						if(!bool) {

							cb(mod, {});
							app.log.info("config: No package file! (%s)", mod);
							return;
						}
						fs.readFile(pkg, parse);
					});
				}
			;
			fs.readFile(conf, emit);
		}
		, embedded = function embedded(mod) {

			var exclude = [
				'serial',
				'platform',
				'rest'
			]
			return (exclude.indexOf(mod)===-1)
		}
	;

	mkdirp(modPath, read);

	ninja.app.emit('loaded'); // done loading modules
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
	// rest interface
	ninja.loadModule(

		'rest'
		, ninja
		, app
	);
};