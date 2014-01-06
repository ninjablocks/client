var util = require('util');
var PollingDevice = require('./PollingDevice');
var P = require('../lib/protocol');

util.inherits(Driver, PollingDevice);

function Driver(address, headers, zigbeeDevice, socket) {
    this._incomingCommand = P.RPCS_HUMID_READING;
    this._outgoingCommand = P.RPCS_GET_HUMID_READING;

    this.V = 0;
    this.D = 8; //Humidity Sensor

    this._pollInterval = 30000;

    Driver.super_.apply(this, arguments);
}

Driver.prototype.readZigbeeValue = function(reader) {
    reader.word16lu('value');
    return reader.vars.value / 100;
};

module.exports = Driver;
