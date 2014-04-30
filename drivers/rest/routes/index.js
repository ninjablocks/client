'use strict';

var helpers = require('../lib/helpers');

exports.showDevices = function(req, res){
  res.json({
    result: 1,
    error: null,
    id: 0,
    data: req.devices
  });
};

exports.actuate = function(req,res) {

  if (!req.body.hasOwnProperty('DA')) {
    res.json({error:'Invalid parameter, you must provide a DA value'}, 400);
    return;
  }

  if (!req.ninja.devices.hasOwnProperty(req.params.deviceGuid)) {
    res.json({error:'Unknown Device'},404);
    return;
  }

  var guid = req.params.deviceGuid;
  var device = req.ninja.devices[guid];

  try {
    res.json({
      result: 1,
      error: null,
      id: 0
    });
  } catch (err) {
    res.json({
      result: 0,
      error: err,
      id: 500
    });
  }
};