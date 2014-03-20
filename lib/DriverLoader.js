'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var path = require('path');
var async = require('async');

require('colors');

function DriverLoader(app, configPath) {
  this.app = app;

  this.log = app.log.extend('DriverLoader');
  this.configPath = configPath;

  this.drivers = [];

  var driverPaths = Array.prototype.slice.call(arguments);
  // Remove app and configPath params
  driverPaths.shift();
  driverPaths.shift();

  this.log.debug('Using driver paths:', driverPaths);
  this.log.debug('Using config path:', configPath);

  var self = this;

  driverPaths.forEach(function(path) {
    self.log.info('Loading drivers from path', path);

    try {
      fs.readdirSync(path).forEach(function(driver) {
        self.loadDriver(driver, path + '/' + driver);
      });
    } catch(e) {
       self.log.warn('Failed to load drivers from path', path, e);
      return;
    }

  });

  app.on('config::request', function(id, requests, sync) {
    this.log.debug('Module config request received', id, requests);
    var log = this.log;

    var todo = [];
    function addTodo(name, driver, request) {
      todo.push(function(done) {
        driver.config(request.data, function(err, response) {
          // XXX: The old client didn't handle errors either?? What do we do?
          if (err) return done(null);

          done(null, {
            type: 'MODULE',
            module: name,
            data: response
          });
        });
      });
    }

    // INCOMING : {"CONFIG":[{"type":"MODULE"}],"id":"3f20405a99e0","sync":false,"TIMESTAMP":1395198395258}
    requests.forEach(function(request) {
      this.log.debug('Handling config request');
      if (request.module) {
        // For a specific driver
        this.log.trace(' It\'s for a specific driver (%s)', request.module);
        addTodo(request.module, this.drivers[request.module], request);
      } else {
        // For all drivers
        this.log.trace(' It\'s for all drivers.');
        for (var driver in this.drivers) {
          if (this.drivers[driver].config && typeof this.drivers[driver].config == 'function') {
            this.log.trace(' Sending to', driver);
            addTodo(driver, this.drivers[driver], request);
          }
        }
      }
    }.bind(this));

    //
    async.parallel(todo, function(err, replies) {
      this.log.trace('Got replies', JSON.stringify(replies), 'err', err);
      app.emit('config::reply', id, replies, sync);
    }.bind(this));

  }.bind(this));

}

DriverLoader.prototype.loadDriver = function(name, path) {

  if (this.drivers[name]) {
    this.log.warn('Driver', name.yellow, 'has already been loaded. Skipping.');
    return;
  }

  this.log.info('Loading driver', name.yellow, 'from path', path.yellow);

  // TODO: Handle config
  var config = this.loadConfig(name);

  var driverInfo;

  try {
     driverInfo = require(path + '/package.json');
  } catch(e) {
    this.log.warn('Failed to load', 'package.json'.yellow, 'from path', path.yellow);
    return;
  }

  if (!config) {
    config = driverInfo.config || {};
    this.saveConfig(name, config);
  }

  var Driver;

  try {
    Driver = require(path + '/index');
  } catch(e) {
    this.log.warn('Failed to load driver from', path, e);
    return;
  }

  // Replace the app log briefly... not the nicest way.. but some drivers steal it at the beginning.
  var oldLog = this.app.log;
  this.app.log = this.app.log.extend(name);

  var driver = new Driver(config, this.app, function(){}); // XXX: Empty 'version' function for ninja-arduino. I don't care.
  driver.log = this.app.log;

  this.app.log = oldLog;

  driver.save = function(cfg) {
    this.saveConfig(name, config);
  }.bind(this);

  driver.opts = config;

  driver.on('register', function(device) {
    driver.log.debug('Device registered', device);
    this.app.emit('device::register', device, name);
  }.bind(this));

  driver.on('announcement', function(data) {

    var announcement = {
        type : 'MODULE_ANNOUNCEMENT',
        module : name,
        data : data
    };

    process.nextTick(function() {
      driver.log.debug('Sending announcement');
      this.app.emit('config::reply', null, [announcement]);
    }.bind(this));

  }.bind(this));

  this.drivers[name] = driver;

};

DriverLoader.prototype.loadConfig = function(driver) {
  try {
    return require(path.resolve(this.configPath, driver, 'config.json'));
  } catch(e) {
    this.log.warn('Failed to load config for driver', driver.yellow);
    return null;
  }
};

DriverLoader.prototype.saveConfig = function(driver, config) {
  this.log.debug('Saving config for driver', driver.yellow, config);
  var dir = path.resolve(this.configPath, driver);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.writeFileSync(dir + '/config.json', JSON.stringify(config), 'utf-8');
};

module.exports = DriverLoader;