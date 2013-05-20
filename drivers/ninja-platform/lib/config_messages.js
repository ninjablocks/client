exports.platformWelcome = {
  "contents":[
    { "type": "paragraph", "text":"Driver for interaction with the Arduino inside the Ninja Block"},
    { "type": "submit", "name": "Flash", "rpc_method": "manual_board_version" },
    { "type": "close", "text": "Close"}
  ]
};

exports.flashduinoFetchVersionNumber = {
  "contents":[
    { "type": "paragraph", "text":"Please select your arduino board version number"},
    { "type": "input_field_text", "field_name": "arduino_board_version", "value": "V12", "label": "Arduino Board Version", "placeholder": "V12", "required": true},
    { "type": "submit", "name": "Flash", "rpc_method": "confirm_flash_arduino" },
    { "type": "close", "text": "Cancel" }
  ]
};

exports.flashduinoConfirmToFlash = {
  "contents":[
    { "type": "paragraph", "text":"Ready to download and flash arduino. Are you sure?"},
    { "type": "submit", "name": "Yes", "rpc_method": "flashduino_begin" },
    { "type": "close", "text": "No" }
  ]
};

exports.flashduinoFlashingArduino = {
  "contents":[
    { "type": "paragraph", "text":"Flashing arduino. Please wait for the status LED to return to green"},
    { "type": "close", "text": "OK" }
  ]
};

exports.finish = {
  "finish": true
};
