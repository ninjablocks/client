var util = require('util');
var Device = require('./Device');
var P = require('../lib/protocol');

util.inherits(IASZone, Device);

var ZONE_STATE_BITS = [
    'Alarm1',
    'Alarm2',
    'Tamper',
    'Battery',
    'SupervisionReports',
    'RestoreReports',
    'Trouble',
    'AC',
    'Reserved1',
    'Reserved2',
    'Reserved3',
    'Reserved4',
    'Reserved5',
    'Reserved6',
    'Reserved7',
    'Reserved8'
];

function IASZone(address, headers, zigbeeDevice, socket) {
    IASZone.super_.apply(this, arguments);

    this.writable = false;
    this.V = 0;
    this.D = 600; // IAS Zone

    this.onCommand(P.RPCS_ZONESTATE_CHANGE, function(address, reader) {
        this.readState(reader);
    }.bind(this));

    setInterval(function() {
       // this.fetchState();
    }.bind(this), 30000);
}

IASZone.prototype.readState = function(reader) {

    reader.word16lu('zoneState');

    this.log.debug('Zone State : ', reader.vars.zoneState);

    var state = {};
    reader.vars.zoneState.toString(2).split('').reverse().forEach(function(bit, pos) {
        state[ZONE_STATE_BITS[pos]] = (bit === '1');
    });

    state.timestamp = new Date().getTime();

    this.log.debug('Zone State Parsed : ', state);

    this.emit('data', state);
};

IASZone.prototype.fetchState = function() {
    this.readAttribute(0x0500, 0x0002, function(reader) {
      console.log("GOT ATTRIBUTE RESPONSE", reader.vars.dataType.toString(16), reader.vars);
      this.readState(reader);
    }.bind(this));
};

module.exports = IASZone;
