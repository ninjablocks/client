var util = require('util');
var Device = require('./Device');
var P = require('../lib/protocol');

util.inherits(OnOffSwitch, Device);

// TODO: Support cluster "Level Control" for device "Level Control Switch"
function OnOffSwitch(address, headers, zigbeeDevice, socket) {
    OnOffSwitch.super_.apply(this, arguments);

    this.writable = false;
    this.V = 0;
    this.D = 244; // state device

    this.bindToCluster('On/Off');

    this.onCommand(P.SRPC_ONOFF_CMD, function(address, reader) {
        reader.word8('value');

        this.log.debug('State change value : ', reader.vars.value);

        this.emit('data', reader.vars.value === 0? 0 : 1);

    }.bind(this));
}

module.exports = OnOffSwitch;
