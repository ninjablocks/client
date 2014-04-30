'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var existsSync = fs.existsSync || path.existsSync;

/**
 * credential provider for user-defined
 * token & serial functions
 */

function Credentials(opts, app) {

  this.opts = opts;
  this.app = app;
  this.log = app.log.extend('Credentials');

  this.token = null;
  this.serial = null;

  // if the serial does not exist
  if (!existsSync(opts.serialFile)) {

    // If the serial file does not exist, create one
    var generatedSerial = crypto.randomBytes(8).toString('hex').toUpperCase();
    var dirName = path.dirname(opts.serialFile);

    try {
      mkdirp.sync(dirName);
      fs.writeFileSync(opts.serialFile, generatedSerial);
    } catch (e) {

      if (e.code == 'EACCES') {
        this.log.error(
          'Filesystem permissions error (%s)', opts.serialFile
        );
      } else {
        this.log.error(
          'Cannot create serial file (%s): %s', opts.serialFile, e
        );
      }
      return process.exit(1);
    }
  }

  this.saveToken = function saveToken(creds, cb) {

    var self = this;
    var cred = 'token';
    var cFile = this.opts.tokenFile || undefined;
    if (!cFile) {
      this.log.error('Unable to save %s to file (no path specified)', cred);
      cb(new Error('Unable to save token file.'));
      return;
    }
    this.log.debug('Attempting to save %s to file...', cred);

    fs.writeFile(cFile, creds.token, function(err) {
      if (err) {
        self.log.error('Unable to save %s file (%s)', cred, err);
        cb(err);
        return;
      }
      self.log.info('Successfully saved %s to file', cred);
      cb();
    });

  };

  this.loadToken = function loadToken() {

    var cred = 'token';
    var cFile = this.opts.tokenFile || undefined;

    return this.loadFile(cred, cFile);
  };

  this.saveSerial = function saveToken() {

    var cred = 'serial';
    var cFile = this.opts[cred + 'File'] || undefined;

    if (!cFile) {
      this.log.error('Unable to save %s to file (no path specified)', cred);
      return false;
    }
    this.log.debug('Attempting to save %s to file...', cred);

    try {

      fs.writeFileSync(cFile, this[cred]);
    } catch (e) {
      this.log.error('Unable to save %s file (%s)', cred, e);
      return false;
    }
    this.log.info('Successfully saved %s to file', cred);
    return true;
  };

  this.loadSerial = function loadSerial() {

    var cred = 'serial';
    var contents = '';
    var cFile = this.opts[cred + 'File'] || undefined;
    var serial = this.loadFile(cred, cFile);
    if (!serial.length) {
      throw new Error('Serial file is empty:', cFile);
    }
    return serial;
  };

  this.loadFile = function loadFile(cred, cFile) {

    var contents = '';

    if (!cFile) {

      this.log.error('Unable to load %s from file (no path specified)', cred);
      return false;
    }

    try {

      if (existsSync(cFile)) {
        contents = fs.readFileSync(cFile, 'utf8');
      }

    } catch (e) {
      this.log.error('Unable to load %s from file (%s)', cred, e);
      return false;
    }

    this[cred] = contents.replace(/\n/g, '');
    this.log.info('Successfully loaded %s from file', cred);
    return this[cred];
  };


  /**
   * Respond to revokeCredential requests from dojo
   * and other calls for token removal
   */
  this.app.on('client::invalidToken', function() {

    this.log.debug('Attempting to invalidate token...');
    this.mqttId = undefined;
    this.token = undefined;
    this.saveToken(console.err);

  }.bind(this));

  this.loadToken();
  this.loadSerial();

  this.log.info('This Ninja\'s Serial: %s', this.serial);
  return this;
}

module.exports = Credentials;
