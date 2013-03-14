var
	fs = require('fs')
	, path = require('path')
	, util = require('util')
	, events = require('events')
	, argv = require(path.resolve(__dirname, 'app', 'argv'))
	, client = require(path.resolve(__dirname, 'app', 'client'))
	, config = require(path.resolve(__dirname, 'app', 'config'))
	, logger = require(path.resolve(__dirname, 'lib', 'logger'))
	, domain = require('domain')
	, app = new events.EventEmitter()
	, log = new logger(argv)
;

process.chdir(__dirname); // avoid relative hacks

logger.default = app.log = log;

d = domain.create();

d.on('error', function(err) {

	log.error(err);

	/**
	 * Do more stuff with errors.
	 * err should include .stack,
	 * which we could pipe to the cloud
	 * at some point, it would be useful!
	 */
});

d.add(app);



app.on('error', function(err) {

	log.error(err);

	/**
	 * Do more stuff with errors.
	 * err should include .stack,
	 * which we could pipe to the cloud
	 * at some point, it would be useful!
	 */
});

var ninja = new client(argv, app);

d.add(ninja);

if(!ninja) {

	log.error("Unable to create ninja client.");
	process.exit(1);
}

config(ninja, app);

/**
 * Note about apps (event emitters):
 *
 * We can instantiate multiple apps to
 * allow our modules to be namespaced/sandboxed
 * if we so desire. This allows us to provide
 * isolation without any additional infrastructure
 */

process.on('uncaughtException',function(err) {
	log.error(err);
});
