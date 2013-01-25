var helpers = require('../lib/helpers');

exports.showDevices = function(req, res){
  var devices = helpers.buildDeviceMap(req.ninja.devices);
  res.json(devices);
};

exports.actuate = function(req,res) {

  if (!req.body.hasOwnProperty('DA') || typeof req.body.DA !== "string") {
    res.json({error:'Invalid parameter, DA must be a string'},400);
    return;
  }

  if (!req.ninja.devices.hasOwnProperty(req.params.deviceGuid)) {
    res.json({error:'Unkown Device'},404);
    return;
  }

  var guid = req.params.deviceGuid;
  var device = req.ninja.devices[guid];

  device.write(req.body.DA);
  res.send(200);
};