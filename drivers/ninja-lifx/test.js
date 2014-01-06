var EventEmitter = require('events').EventEmitter;

var opts = {};

var app = new EventEmitter();
app.log = {
    debug: console.log,
    info: console.log,
    warn: console.log,
    error: console.log
};

var driver = new (require('./index'))(opts, app);

driver.on('register', function(device) {
    console.log('Driver.register', device);
    device.on('data', function(value) {
        console.log('Device.emit data', value);
    });
    if (device.D == 1008) { //It's a light
      setInterval(function() {
         device.write({bri:254,sat:254,hue:Math.floor(Math.random()* 65535),on:true,transitionTime:0});
      }, 200);
    }
/*
    if (device.D == 238) { //It's a relay
      var x = false;
      setInterval(function() {
         device.write(x=!x);
      }, 1000);
    }*/

});

driver.save = function() {
    console.log('Saved opts', opts);
};

setTimeout(function() {
    app.emit('client::up');
}, 500);
