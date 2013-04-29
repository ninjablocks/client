var exports = module.exports
 ,  messages = require('./config_messages')

exports.probe = function(cb) {
  cb(null, messages.platformWelcome);
};

exports.manual_board_version = function(params,cb) {
  cb(null, messages.flashduinoFetchVersionNumber);
};

exports.confirm_flash_arduino = function(params,cb) {
  this.setArduinoVersionToDownload.call(this, params.arduino_board_version);
  cb(null, messages.flashduinoConfirmToFlash);
};

exports.flashduino_begin = function(params,cb) {
  cb(null, messages.flashduinoFlashingArduino);
  this.flashArduino.call(this, null);
};

