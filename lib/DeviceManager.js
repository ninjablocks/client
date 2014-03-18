'use strict';

function DeviceManager(app, cloud) {
  this.app = app;
  this.cloud = cloud;

  this.log = app.log.extend('DeviceManager');

  this.devices = {};

  this.app.on('device::register', function(device, driver) {

    device.guid = app.getGuid(device);

    if (this.devices.hasOwnProperty(device.guid)) {
      this.log.info('Duplicate device handler ignored (%s)', device.guid);
      return;
    }

    device.driver = driver;

    device.on('data', this.dataHandler.bind(this, device));
    device.on('heartbeat', this.heartbeatHandler.bind(this, device));
    device.on('error', this.errorHandler.bind(this, device));

    this.log.info('Registering device %s', device.guid);
    this.devices[device.guid] = device;
    app.emit('device::up', device.guid, device);

    device.emit('heartbeat');

  }.bind(this));
}

DeviceManager.prototype.dataHandler = function(device, data) {
  this.cloud.sendData({
    G: device.G,
    V: device.V,
    D: device.D,
    DA: data
  });
};

DeviceManager.prototype.heartbeatHandler = function(device, data) {
  this.log.error('Heartbeat not handled yet');
};

DeviceManager.prototype.errorHandler = function(device, e) {
  this.log.error('Device error', device.guid, e);
};

module.exports = DeviceManager;