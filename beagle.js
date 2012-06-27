(function() {

var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    http = require('http'),
    io = require('socket.io-client'),
    sutil = require('./lib/client-utils'),
    serialport = require('serialport'),
    SerialPort = serialport.SerialPort;

// base config for beagle
var config =  {
    cloudHost: 'dojo.ninja.is',
    cloudPort: 443,
    devtty: "/dev/ttyO1",
    serialFile: "/etc/opt/ninja/serial.conf",
    tokenFile: "/etc/opt/ninja/token.conf",
    heartbeat_interval: 500,
    secure:true
};
var nodedetails = {};
// commandline config overwrites
if (process.argv[2] == 'local') {
    config.cloudHost = process.argv[3];
    config.cloudPort = 3001;
    config.secure = false;
}
if (process.argv[4] == 'ftdi') {
    config.devtty = "/dev/tty.usbserial-AE01AAE3";
}

nodedetails.id = fs.readFileSync(config.serialFile).toString().replace(/\n/g,''); // TODO
nodedetails.token = (path.existsSync(config.tokenFile)) ? fs.readFileSync(config.tokenFile).toString().replace(/\n/g,'') : false;

var tty = new SerialPort(config.devtty, { 
    parser: serialport.parsers.readline("\n")
});

var ioOpts = {
    'port':config.cloudPort,
    'transports':['xhr-polling'],
    'try multiple transports':false,
    'secure':config.secure
};

var socket = io.connect(config.cloudHost,ioOpts);

socket.on('connecting',function(transport){
    console.log("Connecting");
    currentState="connecting";
    sutil.changeLEDColor(tty,'cyan');
});
socket.on('connect', function () {
    console.log("Connected");
    console.log("Authenticating");
    socket.emit('hello',nodedetails.id);
});

socket.on('whoareyou',function() {
    if (nodedetails.token) {
        socket.emit('iam',nodedetails.token);
    } else {
        sutil.changeLEDColor(tty,'purple');
        socket.emit('notsure');
        socket.on('youare',function(token) {
            fs.writeFileSync(config.tokenFile, token.token, 'utf8');
            nodedetails["token"] = token.token;
            socket.emit('iam',token.token);
        });
    }
});

var sendIv;
socket.on('begin',function() {
    console.log("Authenticated");
    console.log("Sending/Receiving...");
    clearInterval(sendIv);
    sendIv = setInterval(function(){
        if (beatThrottle.isGoodToGo()) {
            socket.emit('heartbeat',getHeartbeat());
        } 
    },config.heartbeat_interval);    
    setStateToOK();
});

socket.on('command',function(data) {
    executeCommand(data);
});

socket.on('invalidToken',function() {
    console.log("Invalid Token, rebooting");
    // Delete token
    fs.unlinkSync(config.tokenFile);
    // Restart
    process.exit(1);
});

socket.on('error',function() {
    console.log("Socket error, retrying connection")
    setTimeout(function () {
        socket = io.connect(config.cloudHost);
    }, 1000);
    setStateToError();
});

socket.on('disconnect', function () {
    console.log("Disconnected, reconnecting")
    setStateToError();
    setTimeout(function () {
        socket = io.connect(config.cloudHost);
    }, 1000);
});
socket.on('connect_failed', function () {
    console.log("Connect failed, retrying");
    setStateToError();
    setTimeout(function () {
        socket = io.connect(config.cloudHost);
    }, 1000);
});


var deviceMeta = {
    '0': {
        '5': {
            instant:true
        },
        '7': {
            instant:true
        },
        '10': {
            instant:true
        }
    }
};

var readings = {};

tty.on('data',function(data){
    handleRawTtyData(data);
});

var handleRawTtyData = function(data) {
    var jsonTtyData = sutil.getJSON(data) || false;
    if (!jsonTtyData) return;
    var deviceDataPoints = jsonTtyData.DEVICE;
    if (!(deviceDataPoints instanceof Array)) return;
    // only keep latest reading per device between heartbeats
    for (var i=0; i<deviceDataPoints.length; i++) {
        var device = deviceDataPoints[i];
        // Build the GUID
        device.GUID = buildDeviceGuid(device);
        // If we have meta data about the device, handle it.
        if (deviceHasMetaData(device)) {
            var meta = getDeviceMetaData(device);
            if (meta.instant) trySendInstantData(device);
        }
        // Add the devices data to the heartbeat container
        readings[deviceDataPoints[i].GUID] = deviceDataPoints[i];
    }
};

var buildDeviceGuid = function(device) {
    return nodedetails.id+'_'+device.G+'_'+device.V+'_'+device.D;
};

var deviceHasMetaData = function(device) {
    return (deviceMeta[device.V]&&deviceMeta[device.V][device.D]);
};

var getDeviceMetaData = function(device) {
    return deviceMeta[device.V][device.D];
};

var instantContainer = {};
var trySendInstantData = function(deviceData) {
    if (instantContainer.hasOwnProperty(deviceData.GUID)) {
        // We've got stuff
        if (instantContainer[deviceData.GUID].DA!==deviceData.DA) {
            // It's different
            var newMsg = {
                "NODE_ID":nodedetails.id,
                "TIMESTAMP": new Date().getTime(),
                "DEVICE":[deviceData]
            }
            socket.emit('data',JSON.stringify(newMsg));
        }
    }
    instantContainer[deviceData.GUID] = deviceData;
};

var getHeartbeat = function(){
    var hb = {  
        "NODE_ID":nodedetails.id,
        "TIMESTAMP": null,
        "DEVICE":[] 
    };
    hb.TIMESTAMP = new Date().getTime();
    for (r in readings) {
        hb.DEVICE.unshift(readings[r]);
    }
    readings={};
    return JSON.stringify(hb);        
}

var emptyBeats = 0;

var beatThrottle = {
    isGoodToGo : function() {
        if (!sutil.isEmpty(readings) || beatThrottle.counter>beatThrottle.rate) {
            beatThrottle.counter = 0;
            return true;
        } else {
            beatThrottle.counter++;
            return false;
        }
    },
    rate : 10000/config.heartbeat_interval,
    counter: 0
};

var executeCommand = function(data){
    var data = sutil.getJSON(data);
   //if (data && data.welcome) return;
    var ds = data.DEVICE;
    if (ds && ds.length>0) {
        for (d in ds) {
            delete ds[d].GUID;
            ds[d].G = ds[d].G.toString(); //TODO get JP to fix for 0
            sutil.writeTTY(tty,'{"DEVICE":['+JSON.stringify(ds[d])+']}');
        }
    } else {
        console.log(data.toString());
    }
}

var setStateToOK = function() {
    sutil.changeLEDColor(tty,'green');
};

var setStateToError = function() {
    sutil.changeLEDColor(tty,'red');
};
/*  Future release
var Inotify = require('inotify-plusplus'), // should be 'inotify++', but npm has issues with the ++
    inotify,
    directive,
    options;

inotify = Inotify.create(true); // stand-alone, persistent mode, runs until you hit ctrl+c
directive = (function() {
    // multiple events may fire at the same time
    return {
      create: function (ev) {
        // Send the device added message to the server here
        if(ev.name == 'v4l'){
            console.log(ev.name + " was added.");
            // mjpg_streamer -i /usr/local/lib/input_uvc.so -o "/usr/local/lib/output_http.so -p 5000"
        }
      },
      delete: function(ev) {
        // Send the device removed message to teh server here 
        if(ev.name == 'v4l'){
            console.log(ev.name + " was removed.");
        }
      }
    };
}());
inotify.watch(directive, '/dev/');
*/
})();