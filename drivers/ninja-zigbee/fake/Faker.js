// Creates fake devices to help test widgets etc. without actual hardware

var ZigbeeProfileStore = require('../lib/ZigbeeProfileStore');

function Faker(driver) {
    var store = new ZigbeeProfileStore(['ha']);

    var FakeIASZone = require('./FakeIASZone');

    store.on('ready', function() {
        var device = store.getDevice('0x0104', '0x0402');

        for (var i = 0; i < 30; i++) {
            driver.emit('register', new FakeIASZone(device));
        }
    });

}

module.exports = Faker;
