'use strict';
var accio = require;

var events = accio('events');
var CloudConnection = accio('./lib2/CloudConnection');
var Log = accio('./lib2/Log');
var Credentials = accio('./lib2/Credentials');

process.on('uncaughtException', function(err) {
  Log.getLogger('UNCAUGHT EXCEPTION').error(err);
});

var opts = accio('./app/argv');

var app = new events.EventEmitter();
app.log = Log.getLogger('NB');

var creds = new Credentials(opts, app);

var cloud = new CloudConnection(opts, creds, app);

cloud.connect();