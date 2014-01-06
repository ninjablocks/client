var util = require('util');
var stream = require('stream');
var lifx = require('lifx');
lifx.setDebug(true);

util.inherits(Driver, stream);
util.inherits(Bulb, stream);
module.exports = Driver;

function Driver(opts,app) {
  var self = this;

  this._app = app;
  this._opts = opts;
  this._opts.stations = opts.stations || [];

  var devices = {};

  app.once('client::up', function() {
    console.log('Firing up!');
    var lx = lifx.init();

    lx.on('bulb', function(bulb) {
      console.log('New bulb found: ', bulb);

      var device  = new Bulb(bulb, lx);
      if (!devices[device.G]) {
        console.log('Registering bulb');
        devices[device.G] = device;

        self.emit('register', device);
      }
    });
  });
};

function Bulb(bulb, lx) {

  var self = this;

  this.lx = lx;
  this.bulb = bulb;

  this.writeable = true;
  this.readable = true;
  this.V = 0;
  this.D = 1008;
  this.G = 'Lifx' + bulb.lifxAddress.toString('hex');
  this.name = 'Lifx - ' + (bulb.name||'(No Name)');
  
  console.log(this);
}

Bulb.prototype.write = function(data) {
  if (typeof data === 'String') {
    data = JSON.parse(data);
  }

  console.log('Writing to hue', data);
  
  this.lx.lightsColour(data.hue, data.sat*256, data.bri*256, 0x0dac/*TODO*/, data.transitionTime||0, this.bulb);
}

