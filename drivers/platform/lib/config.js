var messages = require('./config_messages')

exports.probe = function(cb) {
  cb(null, messages.platformWelcome);
};

exports.manual_board_version = function(params,cb) {
  cb(null, messages.flashduinoFetchVersionNumber);
};

exports.confirm_flash_arduino = function(params,cb) {

  cb(null, messages.flashduinoConfirmToFlash);
};

exports.flashduino_begin = function(params,cb) {
  //TODO: fork flashing process
  console.log("(placeholder for arduino flashing process...)");
  cb(null, messages.flashduinoFlashingArduino);
};

