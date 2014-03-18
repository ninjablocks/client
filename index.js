'use strict';
var accio = require;

var events = accio('events');
var CloudConnection = accio('./lib2/CloudConnection');
var Log = accio('./lib2/Log');
var Credentials = accio('./lib2/Credentials');
var DriverLoader = accio('./lib2/DriverLoader');
var fs = accio('fs');
var path = accio('path');

var app = new events.EventEmitter();
app.log = Log.getLogger('NB');

var banner = fs.readFileSync('./lib2/banner', 'utf-8');
app.log.debug(banner);

var opts = accio('./lib2/Options');
app.opts = opts;

process.on('uncaughtException', function(err) {
  app.log.error('UNCAUGHT EXCEPTION', err);
});

var drivers = new DriverLoader(app, path.resolve(__dirname, 'config'), path.resolve(__dirname, 'drivers'));

var creds = new Credentials(opts, app);
var cloud = new CloudConnection(opts, creds, app);

cloud.connect();