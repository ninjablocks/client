var util = require('util');
var Device = require('./Device');

util.inherits(LightSensor, Device);

function LightSensor(address, headers, zigbeeDevice, socket) {
    LightSensor.super_.apply(this, arguments);

    this.writable = false;
    this.V = 0;
    this.D = 6;
}

module.exports = LightSensor;


