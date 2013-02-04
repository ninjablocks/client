var
	mkdirp = require('mkdirp')
	, loader = require('./client/module/loader')
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

	loader(ninja, app);
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