'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var argv = require(path.resolve(__dirname, 'app', 'argv'));
var Client = require(path.resolve(__dirname, 'app', 'client'));
var config = require(path.resolve(__dirname, 'app', 'config'));
var logger = require(path.resolve(__dirname, 'lib', 'logger'));
var domain = require('domain');
var app = new events.EventEmitter();
var log = new logger(argv);

process.chdir(__dirname); // avoid relative hacks

logger.default = app.log = log;

// Prevent warnings when we have lots of drivers.
app.setMaxListeners(99);

d = domain.create();

d.on('error', function (err) {

  log.error(err);

  /**
   * Do more stuff with errors.
   * err should include .stack,
   * which we could pipe to the cloud
   * at some point, it would be useful!
   */
});

d.add(app);

// Prevents errors when we have a lot of drivers running
app.setMaxListeners(99);

app.on('error', function (err) {

  log.error(err);

  /**
   * Do more stuff with errors.
   * err should include .stack,
   * which we could pipe to the cloud
   * at some point, it would be useful!
   */
});

var ninja = new Client(argv, app);

d.add(ninja);

if (!ninja) {

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

process.on('uncaughtException', function (err) {
  log.error(err);
});
