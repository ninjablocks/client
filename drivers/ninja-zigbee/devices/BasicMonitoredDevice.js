var util = require('util');
var Device = require('./Device');
var P = require('../lib/protocol');

util.inherits(BasicMonitoredDevice, Device);

// This driver should only be used with non battery-powered devices, as it will constantly ping it!
function BasicMonitoredDevice(address, headers, zigbeeDevice, socket) {
    BasicMonitoredDevice.super_.apply(this, arguments);

    this.writable = false;
    this.V = 0;
    this.D = 2000; // Sandbox device (to store 'ping' time until I make a proper one)

    setInterval(function() {
       var startTime = new Date().getTime();
       var failed = false;

       var timeout = setTimeout(function() {
        this.emit('data', 0);
        failed = true;
       }.bind(this), 29000);

       this.getBasicInformation(function(reader) {
         clearTimeout(timeout);

         if (!failed) {
            this.emit('data', new Date().getTime() - startTime);
         }
       }.bind(this));

    }.bind(this), 30000);

}

module.exports = BasicMonitoredDevice;
