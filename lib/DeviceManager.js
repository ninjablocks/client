'use strict';

function DeviceManager(app, cloud) {
  this.app = app;
  this.cloud = cloud;

  this.log = app.log.extend('DeviceManager');

  this.devices = {};

  this.app.on('device::register', function(device, driver) {

    device.guid = app.getGuid(device);
    device.log = app.log.extend(driver).extend('Device:' + (device.name?device.name:device.guid));

    if (this.devices.hasOwnProperty(device.guid)) {
      this.log.info('Duplicate device handler ignored (%s)', device.guid);
      return;
    }

    device.driver = driver;

    device.on('data', cloud.dataHandler(device));
    device.on('heartbeat', cloud.heartbeatHandler(device));
    device.on('error', function(e) {
      this.log.error('Device error', device.guid, e);
    }.bind(this));

    this.devices[device.guid] = device;
    app.emit('device::up', device.guid, device);

    device.emit('heartbeat');

  }.bind(this));

  this.app.on('device::command', function(command) {
    var device = this.devices[command.GUID];

    if (device) {
      if (typeof command.DA == 'string') {
        try {
          // Just do our best. :/
          command.DA = JSON.parse(command.DA);
        } catch(e) {}
      }

      device.log.debug('Actuation >', command.DA);
      device.write(command.DA);
    }
  }.bind(this));

}

DeviceManager.prototype.errorHandler = function(device, e) {
  this.log.error('Device error', device.guid, e);
};

module.exports = DeviceManager;