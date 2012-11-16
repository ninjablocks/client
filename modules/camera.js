var fs = require('fs'),
    util = require('util'),
    http = require('http'),
    Device = require('../lib/device.js'),
    Inotify = require('inotify-plusplus'),
    directive,
    cameraIv,
    inotify,
    cameraGuid;

module.exports = function() {
    var cloud = this;

    var camera = new Camera(cloud);

    // Watch for plugins
    inotify = Inotify.create(true); // stand-alone, persistent mode, runs until you hit ctrl+c
    directive = (function() {
        return {
          create: function (ev) {
            if(ev.name == 'v4l') {
                cloud.registerDevice(camera);
                camera._init();
            }
          },
          delete: function(ev) {
            if(ev.name == 'v4l'){
                cloud.deregisterDevice(camera);
                camera.end();
            }
          }
        };
    }());
    inotify.watch(directive, '/dev/');

    // Check if the camera is plugged in
    try {
        var stats = fs.lstatSync('/dev/video0');
        if (stats.isCharacterDevice()) {
            cloud.registerDevice(camera);
            process.nextTick(function() {
                camera._init();
            });
        }
    }
    catch (e) {
        console.log(self.timestamp()+" Camera Not Present");
    }
};

util.inherits(Camera,Device);
function Camera(cloud) {
    this.writeable = true;
    this.readable = true;
    this._cloud = cloud;
    this._interval = 0;
    this.V = 0;
    this.D = 1004;
    this.G = "0";
};

Camera.prototype._init = function() {
    var self = this;
    var cloud = this._cloud;
    console.log(cloud.timestamp()+" Camera is Connected");
    clearInterval(this._interval);
    this._interval = setInterval(function() {
        self.emit('data','1');
    },10000);
    this.emit('data','1');
}

Camera.prototype.write = function(data) {
    var cloud = this._cloud;
    console.log(cloud.timestamp()+" Taking a picture");
    var getOptions = {
        host:'localhost',
        port:5000,
        path:'/?action=snapshot',
        method:'GET'
    };
    var postOptions = {
        host:cloud.config.cloudStream,
        port:cloud.config.cloudStreamPort,
        path:'/rest/v0/camera/'+this.guid+'/snapshot',
        method:'POST',
    };
    console.log(postOptions)
    proto = (cloud.config.cloudStreamPort==443) ? require('https') : require('http')
    var getReq = http.get(getOptions,function(getRes) {
        postOptions.headers = getRes.headers;   
        postOptions.headers['X-Ninja-Token'] = cloud.fetchBlockToken();
        var postReq = proto.request(postOptions,function(postRes) {
            postRes.on('end',function() {
                console.log(cloud.timestamp()+' Stream Server ended');
            });
        });
        postReq.on('error',function(err) {
            console.log(cloud.timestamp()+' Error sending picture: ');
            console.log(err);
        });
        getRes.on('data',function(data) {
            postReq.write(data,'binary');
        });
        getRes.on('end',function() {
            postReq.end();
            console.log(cloud.timestamp()+" Image sent");
        });
    });
    getReq.on('error',function(error) {
        console.log(cloud.timestamp()+" "+error);
    });
    getReq.end();
    return true;
};

Camera.prototype.end = function() {
    clearInterval(this._interval);
};
Camera.prototype.destroy = function() {
    clearInterval(this._interval);
};