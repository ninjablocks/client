var
	fs = require('fs')
	, path = require('path')
	, util = require('util')
	, events = require('events')
	, argv = require(path.resolve(__dirname, 'app', 'argv'))
	, client = require(path.resolve(__dirname, 'app', 'client'))
	// , config = require(path.resolve(__dirname, 'app', 'config'))
	, logger = require(path.resolve(__dirname, 'lib', 'logger'))
	, app = new events.EventEmitter()
	, log = new logger(argv)
	, creds = {}
;

logger.default = log;
app.log = log;

var ninja = new client(argv, creds, app);
/**
 * Note about apps (event emitters):
 * 
 * We can instantiate multiple apps to
 * allow our modules to be namespaced/sandboxed
 * if we so desire. This allows us to provide 
 * isolation without any additional infrastructure
 */

if(argv.device && ninja) {

	ninja.loadModule('serial', { device : argv.device, id : 'arduino' }, app);
}