'use strict';

var path = require('path');
var util = require('util');
var mkdirp = require('mkdirp');
var handlers = require('./module/handlers');
var stream = require('stream');
var tls = require('tls');
var net = require('net');
var fs = require('fs');
var versioning = require(path.resolve(
  __dirname, '..', '..', 'lib', 'versioning'
));
var creds = require(path.resolve(
  __dirname, '..', '..', 'lib', 'credentials'
));
var logger = require(path.resolve(
  __dirname, '..', '..', 'lib', 'logger'
));
var mqtt = require('mqtt');
var mqttrouter = require('mqtt-router');

var subscriptions = require('./subscriptions');


function Client(opts, app) {

  var modules = {}, mod = this;

  if (!opts || Object.keys(opts).length === 0) {

    app.log.error("Invalid opts object provided");
    return false;
  }

  if (!creds || typeof creds !== 'function') {

    app.log.error("Invalid credential provider specified");
    return false;
  }

  stream.call(this);

  this.app = app;
  this.opts = opts || undefined;
  this.sendBuffer = [ ];
  this.modules = { };
  this.devices = { };
  this.log = app.log;
  creds.call(this, opts);
  versioning.call(this, opts);

  this.node = undefined; // upnode
  this.transport = opts.secure ? tls : net; // TODO TLS needs to be configured for MQTT.

  this.versionClient();
}

util.inherits(Client, stream);
util.inherits(Client, subscriptions);

handlers(Client);

//Client.prototype.block = require('./block');

Client.prototype.getHandlers = function () {

  return {

    revokeCredentials: function revokeCredentials() {

      var cli = this;
      this.log.info('Invalid token; exiting in 3 seconds...');
      this.app.emit('client::invalidToken', true);
      setTimeout(function invalidTokenExit() {

        cli.log.info("Exiting now.");
        process.exit(1);

      }, 3000);
    }.bind(this), execute: function execute(cmd, cb) {

      this.log.info('readExecute', cmd);

      this.command(cmd);

    }.bind(this), update: function update(to) {

      this.log.info('readUpdate', cmd);

      this.updateHandler(to);

    }.bind(this),
    config: this.moduleHandlers.config.bind(this),
    install: this.moduleHandlers.install.bind(this),
    uninstall: this.moduleHandlers.uninstall.bind(this)
  }
};


/**
 * Connect the block to the cloud
 */
Client.prototype.connect = function connect() {
  this.log.debug('connect called.');
  var client = this;
  this.node = {};

  // if the system doesn't have a token yet we need to park
  // and wait for registration
  if (!this.token) {
    this.mqttclient = mqtt.createClient(1883, this.opts.cloudHost, {username: 'guest', password: 'guest', keepalive: 30});
  } else {
    this.mqttclient = mqtt.createClient(1883, this.opts.cloudHost, {username: this.serial, password: this.token, keepalive: 30});
  }

//  this.mqttclient.on('reconnect', client.reconnect.bind(client)); //TODO test this new event
  this.mqttclient.on('disconnect', client.down.bind(client));
  this.mqttclient.on('connect', client.up.bind(client));

  // enable the subscription router
  this.router = mqttrouter.wrap(this.mqttclient);

  // subscribe to all the cloud topics
  this.subscribe();

  this.initialize();
};

/**
 * Initialize the session with the cloud after a connection
 * has been established.
 */
Client.prototype.initialize = function initialize() {

  var mod = this
    , flushBuffer = function flushBuffer() {

      if (!this.sendBuffer) {
        this.sendBuffer = [ ];
        return;
      }
      if (this.sendBuffer.length > 0) {

        this.log.debug("Sending buffered commands...");

        var blockId = this.serial;
        var topic = ['$cloud', blockId, 'data'].join('/');

        console.log('sendData', 'flushBuffer', 'mqtt', topic);

        this.sendMQTTMessage(topic, {
          'DEVICE': this.sendBuffer
        });

        this.sendBuffer = [ ];
      }
      else {

        this.log.debug("No buffered commands to send");
      }
    }
    , initSession = function initSession(cloud) {

      mod.cloud = cloud;

      // no more heartbeat x_x
      // if(mod.pulse) { clearInterval(mod.pulse); }
      // mod.pulse = setInterval(beat.bind(mod), 5000);
      flushBuffer.call(mod);
    }
    , beat = function beat() {

      // this.log.debug("Sending heartbeat");
      mod.cloud.heartbeat(JSON.stringify({

        "TIMESTAMP": (new Date().getTime()), "DEVICE": [ ]

      }));
    }
    ;

  this.app.on('client::preup', initSession);
};

/**
 * cloud event handlers
 */
Client.prototype.up = function up(cloud) {

  try {
    this.app.emit('client::preup', cloud)
    this.app.emit('client::up', cloud);
  } catch (err) {

    this.log.error('An unknown module had the following error:\n\n%s\n', err.stack);
  }

  this.log.info("Client connected to the Ninja Platform");
};

Client.prototype.down = function down() {

  this.app.emit('client::down', true);
  this.log.info("Client disconnected from the Ninja Platform");
  if (this.pulse) {

    clearInterval(this.pulse);
  }
};

Client.prototype.reconnect = function reconnect() {

  this.app.emit('client::reconnecting', true);

  this.log.info("Connecting to cloud...");
};

/**
 * Generate scoped parameters for dnode connection
 */
Client.prototype.getParameters = function getParameters(opts) {

  var cloudPort = this.opts.cloudPort;
  var cloudHost = this.opts.cloudHost;
  var transport = this.transport;

  return {

    ping: 10000, timeout: 5000, reconnect: 2000, createStream: function createStream() {

      return transport.connect(cloudPort, cloudHost);
    }, block: this.block.bind(this)
  };
};

Client.prototype.dataHandler = function dataHandler(device) {

  var self = this;
  return function (data) {

    try {

      self.sendData({

        G: device.G.toString(), V: device.V, D: device.D, DA: data
      });
    }
    catch (e) {

      self.log.debug("Error sending data (%s)", self.getGuid(device));
      self.log.error(e);
    }
  }
};

Client.prototype.heartbeatHandler = function dataHandler(device) {

  var self = this;
  return function (hb) {

    try {

      var heartbeat = hb || {};
      heartbeat.G = device.G.toString();
      heartbeat.V = device.V;
      heartbeat.D = device.D;

      if (typeof device.name === 'string') {
        heartbeat.name = device.name;
      }

      self.sendHeartbeat(heartbeat);
    }
    catch (e) {

      self.log.debug("Error sending heartbeat (%s)", self.getGuid(device));
      self.log.error(e);
    }
  }
};

Client.prototype.sendData = function sendData(dat) {

  if (!dat) {
    return false;
  }

  dat.TIMESTAMP = (new Date().getTime());
  var msg = { 'DEVICE': [ dat ] };

  if ((this.mqttclient)) {//  && this.cloud.data) {

    // DEBUGGING
    console.log('sendData', dat);

    var blockId = this.serial;
    var deviceId = [dat.G, dat.V, dat.D].join('_');
    var topic = ['$cloud', blockId, 'devices', deviceId, 'data'].join('/');

    console.log('sendData', 'mqtt', topic);
    this.sendMQTTMessage(topic, msg);

//    return this.cloud.data(msg);
  }

  this.bufferData(msg);
};

Client.prototype.sendConfig = function sendConfig(dat) {

  if (!dat) {
    return false;
  }

  dat.TIMESTAMP = (new Date().getTime());
  if ((this.cloud) && this.cloud.config) {

    // DEBUGGING
    this.log.debug('sendConfig', dat);

    var blockId = this.serial;
    var deviceId = [dat.G, dat.V, dat.D].join('_');
    var topic = ['$cloud', blockId, 'devices', deviceId, 'config'].join('/');
    this.log.debug('sendConfig', 'mqtt', topic);

    this.sendMQTTMessage(topic, dat);

//    return this.cloud.config(JSON.stringify(dat));
  }
};

Client.prototype.sendHeartbeat = function sendHeartbeat(dat) {
  if (!dat) {
    return false;
  }

  dat.TIMESTAMP = (new Date().getTime());
  var msg = { 'DEVICE': [ dat ] };

  if ((this.mqttclient)) {//  && this.cloud.data) {
    this.log.debug('sendHeartbeat', dat);

    var blockId = this.serial;
    var deviceId = [dat.G, dat.V, dat.D].join('_');
    var topic = ['$cloud', blockId, 'devices', deviceId, 'heartbeat'].join('/');
    this.log.debug('sendHeartbeat', 'mqtt', topic);

    this.sendMQTTMessage(topic, dat);

//    return this.cloud.heartbeat(msg);
  }
};

Client.prototype.sendMQTTMessage = function sendMQTTMessage(topic, msg) {

  // add the token to the message as this is currently the only way to identify a unique instance of a
  // block
  msg._token = this.token;

  this.mqttclient.publish(topic, JSON.stringify(msg));
};

Client.prototype.bufferData = function bufferData(msg) {

  this.sendBuffer.push(msg);

  if (this.sendBuffer.length > 9) {

    this.sendBuffer.shift();
  }
};

Client.prototype.command = function command(dat) {

  var self = this, data = this.getJSON(dat);

  for (var d = 0, ds = data.DEVICE; d < ds.length; d++) {

    // console.log("Executing: ");
    // console.log(ds[d]);

    var
      guid = ds[d].GUID
      , device
      ;
    // delete ds[d].GUID;

    ds[d].G = ds[d].G.toString();

    if ((device = this.devices[guid]) && typeof device.write == "function") {

      try {

        this.devices[guid].write(ds[d].DA);
        return true;
      }
      catch (e) {

        this.log.error("error actuating: %s (%s)", guid, err.message);
      }
    }
    else {

      // most likely an arduino device (or a bad module)
      this.log.debug("actuating %s (%s)", guid, ds[d].DA);
      this.app.emit('device::command', ds[d]);
    }
  }
};

Client.prototype.getGuid = function getGuid(device) {

  return [

    this.serial
    , device.G
    , device.V
    , device.D

  ].join('_');
};

Client.prototype.getJSON = function getJSON(dat) {

  try {
    if (dat instanceof Buffer) {
      dat = dat.toString();
    }
    return JSON.parse(dat);
  }
  catch (e) {

    this.log.debug('Invalid JSON: %s', e);
    return false;
  }
};

module.exports = Client;
