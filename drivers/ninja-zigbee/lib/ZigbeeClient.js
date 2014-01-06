// Required libraries/interfaces/classes
var util = require('util');
var Stream = require('stream');
var binary = require('binary');
var log4js = require('log4js');


var P = require('./protocol');
var PresenceDriver = require('./PresenceDriver');

var ZigbeeProfileStore = require(__dirname+'/ZigbeeProfileStore');

// Extend ZigBeeClient class with Stream
util.inherits(ZigBeeClient,Stream);

// Export the ZigBeeClient class
module.exports = ZigBeeClient;

var ZllDeviceIdx = 1;
var ZigBeeDeviceIdx = 1;


/**
 * Creates a new Zigbee Client
 *
 * @class Represents a Zigbee Client
 */
function ZigBeeClient(logger) {

  var self = this;

  this.writable = true;
  this.readable = true;
  this.log = log4js.getLogger('ZB - ZigbeeClient');

  this._profileStore = new ZigbeeProfileStore(['ha', 'zll']);

  this._devices = {};

  this._profileStore.on('ready', function() {
    self.emit('ready');

    /*
    setTimeout(function() {
      var relay =          [1,33,161,194,1,4,  1,    9,0,0,0,1,173,0,0,0,0,96,80,131,0,0,0,96,0,0,0,0,0,0,0,96,2,0,0];
      var onOffLight =  [1,33,161,193,1,94,192,0,0,0,0,1,173,0,0,0,0,96,80,131,0,0,0,96,0,0,0,0,0,0,0,96,2,0,0]; // ES: not real... hand edited
      var dimmableLight = [1,33,161,191,1,94,192,0,1,0,0,1,173,0,0,0,0,96,80,131,0,0,0,96,0,0,0,0,0,0,0,96,2,0,0]; // ES: not real... hand edited
      var colourLight = [1,33,161,192,1,94,192,0,2,0,0,1,173,0,0,0,0,96,80,131,0,0,0,96,0,0,0,0,0,0,0,96,2,0,0]; // ES: not real... hand edited
      var onOffSwitch = [1,33,151,186,2,4,1,3,1,0,0,1,235,0,0,0,0,144,80,131,109,112,108,101,68,101,115,99,82,115,112,58,32,32,149];
      var lightSensor = [1,33,207,193,13,4,1,6,1,0,0,0,194,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      //self.write(new Buffer(onOffSwitch));
      //self.write(new Buffer(relay));
      //self.write(new Buffer(onOffLight));
      //self.write(new Buffer(dimmableLight));
      //self.write(new Buffer(colourLight));
      self.write(new Buffer(relay));
    }, 1000);
    //*/
  });
}

/**
 * Handles the interation over the data received
 * from the SRPC connection.
 *
 * @param  {String} data Data received from the SRPC
 */
ZigBeeClient.prototype.write = function(data) {
  // XXX: TODO: Can multiple messages arrive at once?
  this.log.debug('Processing msg');
  this.processData(data);
};

/**
 * Processes the data received from the SRPC connection.
 *
 * @param  {String} msg    Data received
 * @fires device Zigbee device/cluster description description
 *           message Parly parsed zigbee message
 *
 * TODO: Fix the comments.
 */
ZigBeeClient.prototype.processData = function(msg) {

  var length = msg.length;

  this.log.trace('Incoming ZigBee message. Length: ', length);

  var remainingMessage = msg;

  var used;
  do {
    used = this.readCommand(remainingMessage) + 2; // +2 for length and command id
    remainingMessage = remainingMessage.slice(used);
    this.log.trace('Read command length ', used, 'of', length, '. ', remainingMessage.length,' remaining.');
  } while (remainingMessage.length && used > 0);

};

ZigBeeClient.prototype.readCommand = function(msg) {

  // E.g .
  // [1,33,161,194,1,4,1,9,0,0,0,1,173,0,0,0,0,96,80,131,0,0,0,96,0,0,0,0,0,0,0,96,2,0,0]

  var reader = binary.parse(msg)
    .word8('command')
    .word8('length')
    .word16lu('networkAddress')
    .word8('endPoint');

  var address = reader.vars.networkAddress + ':' + reader.vars.endPoint;

  var device = this._devices[address];

  this.log.debug('Parsed message command:', P.inverted[reader.vars.command] || 'UNKNOWN:' + reader.vars.command.toString(16), 'header : ', JSON.stringify(reader.vars));



  if (reader.vars.command == P.RPCS_NEW_ZLL_DEVICE) {

    reader
      .word16lu('profileId')
      .word16lu('deviceId')
      .word8('version')
      .word8('nameLength')
      .word8('status')
      .word64lu('ieee');

    reader.vars.ieeeHex = pad(reader.vars.ieee.toString(16), 16).toUpperCase();

    if (reader.vars.nameLength !== 0) {
      this.log.error('FIXME: We don\'t support device names yet.');
      return;
    }

    if (reader.vars.networkAddress === 0) {
      this.log.info('This is the coordinator');
      this.emit('coordinator', address, reader.vars);
    } else {
       this._devices[address]  = this._profileStore.getDevice(reader.vars.profileId, reader.vars.deviceId);

       this.emit('device', address, this._devices[address], reader.vars, !device);
    }

  } else {
    if (!device) {
      // ES: I've seen zonestate changes coming through without having seen a NEW_ZLL_DEVICE
      // come through before it...

      this.log.info("Unknown ZigBee device has sent us data. So we'll interrogate to find out what it is.");

      //device = this._devices[address]  = this._profileStore.getDevice('0x0104' /* HA */, '0x0402' /* IAS Zone */);

      //this.emit('device', address, device, reader.vars);
    } else {

    }

    this.emit('command', address, device, reader);
    this.emit(address, address, device, reader);

  }

  return reader.vars.length;
};

/**
 * Advises the SRPC server to discover devices
 *
 * @fires ZigbeeClient#data data to be written to the SRPC connection
 */
ZigBeeClient.prototype.discoverDevices = function() {
  this.log.info('Discovering Devices');

  this.emit('data',new Buffer([P.RPCS_GET_DEVICES, 2, 0, 0]));
  //this.emit('data',new Buffer([P.RPCS_DISCOVER_DEVICES, 2, 0, 0]));
};

/**
 * Tells the Zigbee coordinator to enter pairing mode for the specified number of seconds.
 */
ZigBeeClient.prototype.permitJoin = function(pairingTime) {
  pairingTime = Math.min(pairingTime || 60, 255);
  this.log.info('Entering pairing mode for ' + pairingTime + ' seconds');

  this.emit('data',new Buffer([P.SRPC_PERMIT_JOIN, 3, pairingTime, 0xd4, 0xeb]));
};


ZigBeeClient.prototype.end = function() {};
ZigBeeClient.prototype.destroy = function() {};

 function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }
