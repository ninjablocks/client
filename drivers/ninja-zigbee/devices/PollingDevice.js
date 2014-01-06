var util = require('util');
var Device = require('./Device');
var P = require('../lib/protocol');

util.inherits(PollingDevice, Device);

function PollingDevice(address, headers, zigbeeDevice, socket, driverName) {
    PollingDevice.super_.apply(this, arguments);

    this.writable = false;

    if (!this.readZigbeeValue) {
        throw('The "readZigbeeValue" function must be provided by the subclass of PollingDevice');
    }

    this.onCommand(this._incomingCommand, this.onReading.bind(this));

    setInterval(this.pollForReading.bind(this), this._pollInterval || 60000);
}

PollingDevice.prototype.onReading = function(address, reader) {
    var value = this.readZigbeeValue(reader);
    this.log.debug('Got reading', value);

    this.emit('data', value);
};

PollingDevice.prototype.pollForReading = function() {
    this.sendCommand(this._outgoingCommand);
};

module.exports = PollingDevice;
