'use strict';

var async = require('async');
var semver = require('semver');
var path = require('path');
var fs = require('fs');

module.exports = function versioning(opts) {

  this.version = {
    drivers: { }, client: process.env.NINJA_CLIENT_NAME || 'ninja-client', id: this.serial
  };

  /**
   * Try to get the driver version from its
   * package.json file...
   */
  this.versionPackage = function versionPackage(name, moduleDir, cb) {

    var packageFile = path.resolve(
      moduleDir
      , name
      , 'package.json'
    );

    var contents = undefined;
    var app = this;

    if (!fs.existsSync(packageFile)) {

      this.log.warn("versioning: %s has no package.json file", name);
      cb(name, null);
      return false;
    }
    fs.readFile(packageFile, readFile);

    function readFile(err, dat) {

      if (err) {

        app.log.error(

          "versioning: Error reading %s package.json"
          , name
        );
        cb(name, null);
        return;
      }
      try {

        contents = JSON.parse(dat);
      }
      catch (e) {

        app.log.error(

          "versioning: Error parsing %s package.json"
          , name
        );
        cb(name, null);
        return;
      }
      if (contents.version) {

        app.log.debug(

          "versioning: reporting %s (%s)"
          , contents.version
          , name
        );
        cb(name, contents.version);
        return;
      }
      app.log.error(

        "versioning: %s has no version to report"
        , name
      );
      cb(name, null);
    }
  };

  /**
   * Record the version retrieved from module; either from
   * the package.json or the callback (if available)
   */
  this.versionReport = function versionReport(name, version) {

    if (!name) {
      return false;
    }
    // TODO: figure out what to do about the arduino version not being semver
    if (semver.valid(version) || name == "ninja-arduino") {
      this.version.drivers[name] = version;
      return true;
    }
    this.log.error("versioning: %s did not report a valid version.", name);
    return false;
  };

  /**
   * Retrieve the version method for the given driver
   * and create the appropriate callback for it
   */
  this.versionMethod = function versionMethod(name, moduleDir, driver) {

    var app = this;
    var name = name || undefined;

    this.version.drivers[name] = null;

    if (!name) {
      return;
    }
    if (!(driver) || ['object', 'function'].indexOf(typeof driver) < 0) {

      this.log.error("versioning: Invalid driver provided: %s", name);
      return;
    }
    if (driver.length < 3) {

      app.log.debug("versioning: checking package.json (%s)", name);
      return function packageVersion() {

        app.versionPackage.call(app, name, moduleDir, app.versionReport.bind(app));
      }();
    }
    if (driver.length == 3) {

      app.log.debug("versioning: using version callback (%s)", name);
      return function moduleVersion(version) {

        app.versionReport(name, version);
      }
    }
    app.log.error(

      "versioning: unexpected arity, expecting fewer than 3 (%s)"
      , name
    );
  };

  this.versionClient = function versionClient() {

    var
      clientPackage = path.resolve(process.cwd(), 'package.json')
      , client = this
      ;
    this.versionSystem();
    fs.exists(clientPackage, function (exists) {

      if (!exists) {

        client.log.error("versioning: Client has no package.json");
        return false;
      }
      client.log.debug("versioning: Checking client package.json");
      fs.readFile(clientPackage, readFile);
      function readFile(err, dat) {

        var contents = undefined;
        if (err || !dat) {

          client.log.error("versioning: Error reading client package.json");
          return;
        }
        try {

          contents = JSON.parse(dat);
        }
        catch (e) {

          client.log.error("versioning: Error parsing client package.json");
          return;
        }
        if ((!contents) || !contents.version) {

          client.log.error("versioning: client has no version to report");
          return;
        }
        client.version.node = contents.version;
        client.log.debug(

          "versioning: reporting version %s (client)"
          , contents.version
        );
      };
      function writeVersions() {

        client.log.debug("versioning: Writing versions.json file...");
        try {

          fs.writeFileSync(

            opts.versionsFile
            , JSON.stringify(client.version, null, "\t")
          );
        }
        catch (e) {

          client.log.error("versioning: %s", e);
          return;
        }
      };
      setTimeout(writeVersions, 3000);
    });
  };

  this.versionSystem = function versionSystem() {

    var
      systemFile = '/opt/utilities/sys_version'
      , utilitiesFile = '/opt/utilities/version'
      , client = this
      ;

    if (!fs.existsSync(systemFile)) {

      this.version.system = null;
    }
    else {

      readFile('system', systemFile);
    }
    if (!fs.existsSync(utilitiesFile)) {

      this.version.utilities = null;
    }
    else {
      readFile('utilities', utilitiesFile);
    }

    function readFile(type, file) {

      var contents = fs.readFileSync(file);
      if (!contents) {

        client.version[type] = null;
      }
      else {

        client.version[type] = contents
          .toString()
          .replace(/\n/g, '')
        ;
        client.log.debug(

          "versioning: reporting %s (%s)"
          , client.version[type]
          , type
        )
      }
    }
  };
};
