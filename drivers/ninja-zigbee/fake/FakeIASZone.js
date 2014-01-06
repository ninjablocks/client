/*
 This fake IAS zone device emits random alarm and battery warning states.
*/

var util = require('util');
var IASZone = require('../Devices/IASZone');

util.inherits(Driver, IASZone);

var nextId = 0;

function Driver(device) {
    Driver.super_.apply(this, ['12345:' + nextId++, {}, device, null, 'FakeIASZone']);

    this.battery = Math.random() < 0.1; // 10% chance of low battery

    this.t1 = Math.floor(Math.random() * 1000 * 60 * 3); // Time to alarm start
    this.t2 = Math.floor(Math.random() * 1000 * 60 * (2 + nextId*2)); // Time to alarm end
    this.log.debug('Times', this.t1, this.t2);

    this.sendFakeOccupancy();
}

Driver.prototype.sendFakeOccupancy = function() {
    setTimeout(function() {

        var state = {
            'Alarm1' : true,
            'Battery' : this.battery
        };
        this.emit('data', state);

        setTimeout(function() {
            var state = {
                'Alarm1' : false,
                'Battery' : this.battery
            };
            this.emit('data', state);
            this.sendFakeOccupancy();
        }.bind(this), this.t2);

    }.bind(this), this.t1);
};

module.exports = Driver;
