var helpers = require('../lib/helpers');

exports.showDevices = function(req, res){
  res.json({result:1,error:null,id:0,data:req.devices});
};

exports.actuate = function(req,res) {

  if (!req.body.hasOwnProperty('DA') || typeof req.body.DA !== "string") {
    res.json({error:'Invalid parameter, DA must be a string'},400);
    return;
  }

  if (!req.devices.hasOwnProperty(req.params.deviceGuid)) {
    res.json({error:'Unkown Device'},404);
    return;
  }

  var guid = req.params.deviceGuid;
  var device = req.ninja.devices[guid];
  try {
    device.write(req.body.DA);
    res.json({
      result:1,
      error:null,
      id:0
    });
  }
  catch (err) {
    res.json({
      result:0,
      error:"Unknown Error",
      id:500
    });
  }
};