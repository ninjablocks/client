var
	path = require('path')
	, async = require('async')
	, util = require('util')
	, fs = require('fs')
;

module.exports = moduleLoader;

function moduleLoader(ninja, app) {

	var
		moduleDir = ninja.opts.moduleDir || "drivers"
	;

	getAllModuleFiles(function(err, files) {

		if(err) {

			return ninja.log.error("moduleLoader: %s", err);
		}

		var mods = files.filter(systemModules).filter(dotFiles);
		if(!mods.length) {

			return ninja.log.debug(

				"moduleLoader: no modules found! (%s)"
				, moduleDir
			);
		}

		ninja.log.debug(

			"moduleLoader: loading %s modules (%s)"
			, mods.length
			, mods.join(", ")
		);

		async.map(mods, makeLoadable, loadableResults);
		function loadableResults(err, mods) {

			if(err) { return ninja.log.error("moduleLoader: %s", err); }

			async.parallel(mods, loadModuleResults);
		};
	});

	function loadModuleResults(err, dat) {

		// console.log(err, dat);
	};

	function makeLoadable(mod, cb) {

		moduleConfigData(mod, configResults);
		function configResults(err, dat) {

			if(err) { return cb(err, null); }
			cb(null, function(cb) {

				loadModule(dat, cb);
			});
		};
		function loadModule(conf, cb) {

			ninja.loadModule(

				mod
				, conf
				, app
				, cb
			);
		};
	};
	/**
	 * Return array of directory contents
	 */
	function getAllModuleFiles(cb) {

		fs.readdir(moduleDir, function(err, files) {

			if(err) { return cb(err, null); }
			cb(null, files);
		});
	};

	/**
	 * Return contents of package.json
	 */
	function getModulePackage(mod, cb) {

		var packagePath = path.resolve(

			moduleDir
			, mod
			, 'package.json'
		);
		getModuleFile(packagePath, mod, cb);
	};

	/**
	 * Return contents of config.json
	 */
	function getModuleConfig(mod, cb) {

		var configPath = path.resolve(

			process.cwd()
			, 'config'
			, mod
			, 'config.json'
		);

		getModuleFile(configPath, mod, cb);
	};

	/**
	 * return contents of path
	 */
	function getModuleFile(path, mod, cb) {

		fs.stat(path, statResults);
		function statResults(err, stat) {

			if(err) { return cb(err, null); }
			fs.readFile(path, readResults);
		};

		function readResults(err, dat) {

			if(err) { return cb(err, null); }
			cb(null, dat);
		}
	};

	/**
	 * return config object of module
	 */
	function moduleConfigData(mod, cb) {

		getModuleConfig(mod, configResults);

		function configResults(err, cfg) {

			if(err) { return tryModulePackage(); }

			var dat = ninja.getJSON(cfg) || { };
			if(dat.config) {

				return cb(null, dat.config);
			}
			cb(null, { });
		};
		function tryModulePackage() {

			getModulePackage(mod, packageResults);
		};
		function packageResults(err, pkg) {

			if(err) { return cb(null, { }); }
			cb(null, ninja.getJSON(pkg).config || { });
		};
	};

	function systemModules(mod) {

		var exclude = [

			'serial'
			, 'platform'
			, 'rest'
			, 'common'
		]
		return (exclude.indexOf(mod) === -1)
	};

	function dotFiles(mod) {

		return (!mod.match(/^\..*$/))
	};
};
