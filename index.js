'use strict';
var accio = require;

process.chdir(__dirname); // avoid relative hacks

var events = accio('events');
var fs = accio('fs');
var path = accio('path');
var util = accio('util');

var CloudConnection = accio('./lib/CloudConnection');
var Log = accio('./lib/Log');
var Credentials = accio('./lib/Credentials');
var DriverLoader = accio('./lib/DriverLoader');
var DeviceManager = accio('./lib/DeviceManager');
var Metrics = accio('./lib/Metrics');

var app = new events.EventEmitter();
app.log = Log.getLogger('NB');

var banner = fs.readFileSync('./lib/banner', 'utf-8');
app.log.debug(banner.bold);

// 1. Load our options
var opts = accio('./lib/Options');
app.opts = opts;

Log.addFileAppender(opts.logFile);

if (opts.memwatch) {

  var debugLog = app.log.extend('[Debug Monitoring]');
  debugLog.info('enabling memwatch');
  var memwatch = require('memwatch');

  memwatch.on('leak', function (info) {
    debugLog.warn('Memory Leak', info);
  });

  var nurse = require('nurse');
  var printStats = function () {
    debugLog.debug('Stats', util.inspect(nurse(), {colors: true}));
  };

  setInterval(printStats, 120000);
  printStats();

}

var metrics = new Metrics(app);
metrics.registerMetricsTask();

app.log.info('Environment', process.env.NODE_ENV);
app.log.debug('Configuration', util.inspect(opts, {colors: true}));

app.log.info('------ Starting Client ------');

// 2. Send any uncaught exceptions to our log... 
// XXX: Nothing should be uncaught. Handle it with domains for the drivers.
process.on('uncaughtException', function (err) {
  app.log.error('UNCAUGHT EXCEPTION', err);
});

// 3. Set up our cloud connection
var creds = new Credentials(opts, app);
var cloud = new CloudConnection(opts, creds, app);

app.__defineGetter__('token', function () {
  return creds.token;
});

// 4. Fire up the device manager
var deviceManager = new DeviceManager(app, cloud);

// 5. Load the drivers
var drivers = new DriverLoader(app, path.resolve(__dirname, 'config'), path.resolve(__dirname, 'drivers'));

// XXX: Move me.
app.getGuid = function (device) {
  return [
    creds.serial, device.G, device.V, device.D
  ].join('_');
};

// 6. Connect
cloud.connect();