'use strict';

var mkdirp = require('mkdirp');
var loader = require('./client/module/loader');
var path = require('path');
var fs = require('fs');

/**
 * TODO: configuration profiles
 */

module.exports = function config(ninja, app) {

  if ((!ninja) || !ninja.opts) {

    return false;
  }

  // Give our app opts
  app.opts = ninja.opts;
  app.id = ninja.serial;
  app.token = ninja.token

  loadPlatform(ninja, app); // embedded arduino

  loader(ninja, app);

  setTimeout(function waitThreeSeconds() {

    ninja.connect();
  }, 3000);

  return ninja;
};

function loadPlatform(ninja, app) {

  // TODO: Rest should be taken out of drivers
  var modulePath = path.resolve(process.cwd(), 'drivers');

  // rest interface
  ninja.loadModule(
    'rest'
    , modulePath
    , ninja
    , app
  );
};
