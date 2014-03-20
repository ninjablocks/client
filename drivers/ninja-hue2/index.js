'use strict';

var util = require('util');
var stream = require('stream');

var hue = require('node-hue-api');
var hueapi = new hue.HueApi();

var USERNAME = 'ninjablocks';

function HueDriver(config, app) {
  this.config = config;
  this.app = app;

  this.bridges = {};

  app.once('client::up', function() {
    this.log.debug('Starting up');
    this.log.debug('Configuration', this.config);

    for (var id in config.bridges) {
      this.addBridge(id, config.bridges[id]);
    }

    setInterval(this.findBridges.bind(this), 5 * 60 * 1000);
    this.findBridges();
  }.bind(this));

}
util.inherits(HueDriver, stream);

HueDriver.prototype.findBridges = function() {
  var log = this.log;

  log.debug('Searching for bridges');

  hue.locateBridges(function(err, result) {

      if (err) {
        return log.error('Failed to search for bridges', err);
      }
      result.forEach(function(bridge) {
        this.addBridge(bridge.id, bridge.ipaddress);
      }.bind(this));
  }.bind(this));
};

HueDriver.prototype.registerBridge = function(id, ip) {
  var log = this.log;

  hueapi.createUser(ip, USERNAME, 'NinjaBlocks', function(err) {
    if (err) {
      var retryTime = 10000;
      if (err.type == 101) {
        retryTime = 1000;
      } else {
        log.error('Failed to register user with the bridge', id, ip, err);
      }
      
      setTimeout(function() {
        this.registerBridge(id, ip);
      }.bind(this), retryTime);

      return;
    }

    log.info('Registered user with bridge', id, ip);
    
    this.addBridge(id, ip);
  }.bind(this));
};

HueDriver.prototype.addBridge = function(id, ip) {

  var log = this.log;

  if (!this.config.bridges[id] || this.config.bridges[id] != ip) {
    // Ensure it's saved for next time
    this.config.bridges[id] = ip;
    this.save(this.config);
  }

  if (this.bridges[id]) {
    if (this.bridges[id].host == ip) {
      // All good. We know about this bridge, and it hasn't changed ip.
    } else {
      // The bridge has changed ip. Fix our api client!
      log.warn('Bridge', id, 'has changed ip from', this.bridges[id].host, 'to', ip);
      this.bridges[id].host = ip;
    }
    return;
  }

  log.info('Adding bridge', id, ip);

  var api = new hue.HueApi(ip, USERNAME);
  this.bridges[id] = api;

  api.getFullState(function(err, state) {
    if (err) {
      log.error('Failed to get bridge state', err);
      if (err.code === 'ETIMEDOUT') {
        log.error('Timed out... removing bridge from config');
        delete(this.bridges[id]);
        delete(this.config.bridges[id]);
        this.save(this.config);
      }
      if (err.type === 1) {
        // Unregistered user
        log.info('Unregistered user, registering');
        this.registerBridge(id, ip);
      }
      return;
    }

    log.debug('Full state for bridge', id, JSON.stringify(state, 2, 2));

    for (var lightId in state.lights) {
      this.addLight(api, id, lightId, state.lights[lightId]);
    }

  }.bind(this));
};

HueDriver.prototype.addLight = function(api, stationId, lightId, light) {
  this.log.info('Adding light', lightId, light);

  this.emit('register', new Light(api, stationId, lightId, light.name, light.state));
};

function Light(api, stationId, id, name, state) {
  this.readable = true;
  this.writeable = true;
  this.V = 0;
  this.D = 1008;
  this.name = name;
  this.G = 'hue'+stationId + id;

  this.id = id;
  this.api = api;
  process.nextTick(function() {
    this.emit('data', state);
  }.bind(this));
}
util.inherits(Light, stream);

Light.prototype.write = function(value) {
  if (typeof value == 'string') {
    value = JSON.parse(value);
  }

  this.api.setLightState(this.id, value)
    .then(function(result) {
      this.emit('data', value);
    }.bind(this))
    .fail(function(e) {
      console.error('Hue> Failed to set light', e);
    }.bind(this))
    .done();
};


module.exports = HueDriver;