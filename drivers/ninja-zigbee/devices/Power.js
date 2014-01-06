var util = require('util');
var PollingDevice = require('./PollingDevice');
var P = require('../lib/protocol');

util.inherits(Driver, PollingDevice);

function Driver(address, headers, zigbeeDevice, socket) {
    this._incomingCommand = P.RPCS_POWER_READING;
    this._outgoingCommand = P.RPCS_GET_POWER_READING;

    this.V = 0;
    this.D = 243; //power

    Driver.super_.apply(this, arguments);
}

Driver.prototype.readZigbeeValue = function(reader) {
    reader.word32lu('value');
    return reader.vars.value;
};

module.exports = Driver;
