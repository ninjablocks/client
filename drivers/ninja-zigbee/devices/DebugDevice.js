// Used for unknown zigbee devices. Tries to see if we can get any data from it.

var util = require('util');
var Device = require('./Device');
var P = require('../lib/protocol');

util.inherits(DebugDevice, Device);

function DebugDevice(address, headers, zigbeeDevice, socket) {
    DebugDevice.super_.apply(this, arguments);

    var self = this;

    this.writable = false;
    this.V = 0;
    this.D = 14; // HID

    var cmds = [
        P.RPCS_GET_DEV_STATE,
        P.RPCS_GET_DEV_LEVEL,
        P.RPCS_GET_DEV_HUE,
        P.RPCS_GET_DEV_SAT,
        P.RPCS_GET_THERM_READING,
        P.RPCS_GET_HUMID_READING
    ];

    function nextCommand() {
        self.sendCommand(cmds.pop());
        if (cmds.length) {
            setTimeout(nextCommand, 1000);
        }
    }
    nextCommand();

    this.on('message', function(address, reader) {
        this.log.debug("Incoming command", P.inverted[reader.vars.command], JSON.stringify(reader.vars));
    }.bind(this));
}

module.exports = DebugDevice;
