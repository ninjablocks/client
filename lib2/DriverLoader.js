'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

function DriverLoader(app, configPath) {
  this.app = app;

  this.log = app.log.extend('Driver');

  var driverPaths = Array.prototype.slice.call(arguments);
  // Remove app and configPath params
  driverPaths.shift();
  driverPaths.shift();

  this.log.debug('Using driver paths:', driverPaths);
  this.log.debug('Using config path:', configPath);

  var self = this;

  driverPaths.forEach(function(path) {
    self.log.info('Loading drivers from path', path);

    fs.readdir(path, function(err, list) {
      if (err) {
        self.log.warn('Failed to load drivers from path', path);
        return;
      }
      list.forEach(function(driver) {
        self.loadDriver(driver, path + '/' + driver);
      });

    });
  });

}

DriverLoader.prototype.loadDriver = function(name, path) {
  this.log.info('Loading driver', name, 'from path', path);

  // TODO: Handle config
  var config = {};


  var Driver;

  try {
    Driver = require(path + '/index');
  } catch(e) {
    this.log.warn('Failed to load driver from', path, e);
    return;
  }
  
  // Some drivers need a sec to start up (they were used to not being immediately called).
  // There's no event, so we just wait 2 seconds.

  setTimeout(function() {

    // Replace the app log briefly... not the nicest way.. but some drivers steal it at the beginning.
    var oldLog = this.app.log;
    this.app.log = this.log.extend(name);
    var driver = new Driver(config, this.app, function(){}); // XXX: Empty 'version' function for ninja-arduino. I don't care.
    driver.log = this.app.log;
    this.app.log = oldLog;

    driver.save = function(cfg) {
      config = cfg || config;
      this.log('Saving config', config);
    }.bind(this);

    driver.on('register', function(device) {
      this.log.debug('Device registered', device);

      //new CompatibilityDevice(this, device);
    }.bind(this));

    /*process.nextTick(function() {
      app.emit('client::up');
    });*/

  }.bind(this), 2000);

};

module.exports = DriverLoader;