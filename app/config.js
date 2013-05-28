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

	// Give our app opts
	app.opts = ninja.opts;
	app.id = ninja.serial;
	app.token = ninja.token

	loadPlatform(ninja, app); // embedded arduino

	loader(ninja, app);

	setTimeout(function waitThreeSeconds() {

		ninja.connect();
	}, 3000);

	return ninja;
};

function loadPlatform(ninja, app) {

	// rest interface
	ninja.loadModule(

		'rest'
		, ninja
		, app
	);
};
