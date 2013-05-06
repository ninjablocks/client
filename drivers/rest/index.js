/**
 * Module dependencies.
 */
var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path')
  , stream = require('stream')
  , util = require('util')
  , helpers = require('./lib/helpers')
  , devices = {};

util.inherits(rest,stream);

function rest(ninja) {
  var app = express();

  app.configure(function(){
    app.set('port', process.env.PORT || 8000);
    app.use(function(req, res, next){

      // Custom logger
      ninja.log.info('REST %s %s', req.method, req.url);

      // Give all requests the client (for now).
      req.ninja = ninja;
      req.devices = devices;
      // Keep calm and carry on
      next();
    });

    app.use(express.bodyParser());
    app.use(helpers.allowCORS)
    app.use(app.router);
  });

  app.get('/rest/v0/device',routes.showDevices);
  app.get('/rest/v0/devices',routes.showDevices);
  app.put('/rest/v0/device/:deviceGuid',routes.actuate);
  app.post('/rest/v0/device/:deviceGuid',routes.actuate);

  ninja.app.on('device::up',function(guid) {
    setTimeout(function() {
      helpers.fetchDeviceData(ninja,guid,function(err,data) {

        if (err) {
          ninja.log.error("REST: %s (%s)", err, guid);
          // TODO decide what to do here
        }

        devices[guid] = data;
      });
    },5000);
  });

  http.createServer(app).listen(app.get('port'), function(){

    ninja.log.info("Express server listening on port " + app.get('port'));
  });
};

module.exports = rest;
