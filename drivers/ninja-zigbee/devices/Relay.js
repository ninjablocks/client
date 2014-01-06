var util = require('util');
var PollingDevice = require('./PollingDevice');
var P = require('../lib/protocol');

util.inherits(Driver, PollingDevice);

function Driver(address, headers, zigbeeDevice, socket) {
    this._incomingCommand = P.RPCS_GET_DEV_STATE_RSP;
    this._outgoingCommand = P.RPCS_GET_DEV_STATE;

    this.V = 0;
    this.D = 238; // relay

    this.bindToCluster('On/Off');

    Driver.super_.apply(this, arguments);
}

Driver.prototype.readZigbeeValue = function(reader) {
    reader.word8('value');
    return reader.vars.value === 0?0:1;
};

Driver.prototype.write = function(data) {

    data = (data=== true || data === 1 || data === '1' || data === 'on'); // jic

    this.log.info('Turning ' + (data?'on':'off'));

    this.sendCommand(P.RPCS_SET_DEV_STATE, function(msg) {
        msg.UInt8(data? 0xFF : 0x0);
    });
};

module.exports = Driver;
