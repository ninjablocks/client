var fs = require('fs'),
    Inotify = require('inotify-plusplus'),
    directive,
    cameraIv,
    inotify,
    cameraGuid;

var Camera = module.exports = function() {
    var self = this;
    // Camera
    inotify = Inotify.create(true); // stand-alone, persistent mode, runs until you hit ctrl+c
    directive = (function() {
        return {
          create: function (ev) {
            if(ev.name == 'v4l'){
                cameraGuid = self.buildDeviceGuid(self.config.id,{G:"0",V:0,D:1004});
                clearInterval(cameraIv);
                cameraIv = setInterval(function() {
                    self.readings[cameraIv] = {
                        GUID:cameraGuid,
                        G:"0",
                        V:0,
                        D:1004,
                        DA:"1"
                    };
                },self.config.heartbeat_interval);
            }
          },
          delete: function(ev) {
            if(ev.name == 'v4l'){
                clearInterval(cameraIv);
            }
          }
        };
    }());
    inotify.watch(directive, '/dev/');
    try {
        // Query the entry
        var stats = fs.lstatSync('/dev/video0');
        // Is it a directory?
        if (stats.isCharacterDevice()) {
            // Yes it is
            console.log(self.timestamp()+" Camera is Connected");
            cameraGuid = self.buildDeviceGuid(self.config.id,{G:"0",V:0,D:1004});
            cameraIv = setInterval(function() {
                self.readings[cameraIv] = {
                    GUID:cameraGuid,
                    G:"0",
                    V:0,
                    D:1004,
                    DA:"1"
                };
            },self.config.heartbeat_interval);
        }
    }
    catch (e) {
        console.log(e)
        console.log(self.timestamp()+" Camera Not Present");
    }
};