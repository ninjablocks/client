var util = require('util');
var Device = require('./Device');
var P = require('../lib/protocol');

util.inherits(OccupancySensor, Device);

function OccupancySensor(address, headers, zigbeeDevice, socket) {
    OccupancySensor.super_.apply(this, arguments);

    this.writable = false;
    this.V = 0;
    this.D = 244; // state device

    this.bindToCluster('Occupancy sensing');

    // TODO: Haven't seen an incoming command yet...
    /*this.onCommand(P.SRPC_ONOFF_CMD, function(address, reader) {
        reader.word8('value');

        this.log.debug('State change value : ', reader.vars.value);

        this.emit('data', reader.vars.value === 0? 0 : 1);

    }.bind(this));*/
}

module.exports = OccupancySensor;
