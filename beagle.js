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
    dojoHost: 'http://ninjdojo.herokuapp.com',
    dojoPort:80,
    cloudHost: 'ninj.herokuapp.com',
    cloudPort: 80,
    devtty: "/dev/ttyO1",
    serialFile: "/etc/opt/ninja/serial.conf",
    tokenFile: "/etc/opt/ninja/token.conf",
    heartbeat_interval: 500
};
var nodedetails = {};
// commandline config overwrites
if (process.argv[2] == 'local') {
    config.dojoHost = process.argv[3];
    config.dojoPort = 3001;
    config.cloudHost = process.argv[3];
    config.cloudPort = 3000;
}
if (process.argv[4] == 'ftdi') {
    config.devtty = "/dev/tty.usbserial-AE01AAE3";
    config.serialFile = __dirname+"/serialnumber";
    config.tokenFile = __dirname+"/token";
}
console.log(config);
var tty = new SerialPort(config.devtty, { 
    parser: serialport.parsers.readline("\n")
});

/*
*   Serial Port Stuff
*/
var activationRequiredState = function() {
    console.log("Entered activated requried state");
    changeLEDColor('purple');
    var cmdOptions = {
        host: config.cloudHost,
        port: config.cloudPort,
        path: '/a/block_activation/'+nodedetails.id,
        method: 'GET'
    };
    var longPollConn={};
    var killLongPoll = false;
    var longpoll = function(){
        if (longPollConn.end) longPollConn.end();
        longPollConn = http.get(cmdOptions, function (http_res) {
            http_res.on("data", function (data) {
                parseResponse(data);
            });
            http_res.on("end", function () {
                if (!killLongPoll) longpoll();
            });
            http_res.on("close", function () {
                if (!killLongPoll) longpoll();
            });
            http_res.on("error", function () {
                setTimeout(longpoll,5000);
            });

        }).on('error',function(err){
            console.log('Error in longpoll request: '+err);
            setTimeout(longpoll,5000)
        });
    };

    var parseResponse = function(data){
        // write it to the fs
        var data = sutil.getJSON(data) || false;
        if (data && data.token) {
            fs.writeFileSync(config.tokenFile, data.token, 'utf8');
            nodedetails["token"] = data.token;
            killLongPoll = true;
            longPollConn.end();
            activatedState();   // Set state to activated
        }
    }
    longpoll();
};

var changeLEDColor = function(color) {
    switch (color) {
        case 'purple':
            var hex = 'FF00FF';
        break;
        case 'green':
            var hex = '00FF00';
        break;
        case 'red':
            var hex = 'FF0000';
        break;
        case 'cyan':
            var hex = '00FFFF';
        break;
        default:
            var hex = '000000';
        break;
    }
    sutil.writeTTY(tty,'{"DEVICE":[{"G":"0","V":0,"D":1000,"DA":"'+hex+'"}]}');
}

var activatedState = function() {
    console.log("Entered activated state");

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
            // Log unknown device messages for JP
            if (device.D == 0) console.log("UNKNOWN DEVICE MSG: "+data);

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
                    "TOKEN": nodedetails.token,
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
            "TOKEN": nodedetails.token,
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
    var ioOpts = {
        'port':config.dojoPort,
        'transports':['xhr-polling'],
        'try multiple transports':false
    };
    var socket = io.connect(config.dojoHost,ioOpts);

    var sendIv;
    socket.on('connecting',function(transport){
        currentState="connecting";
        sendingData=false;
        changeLEDColor('cyan');
    });
    socket.on('connect', function () {
        console.log("Connected");
        sendingData=true;
        setStateToOK();
        clearInterval(sendIv);
        sendIv = setInterval(function(){
            if (beatThrottle.isGoodToGo()) {
                socket.emit('heartbeat',getHeartbeat());
            } 
        },config.heartbeat_interval);
    });

    socket.on('invalidToken',function() {
        // Delete token
        fs.unlinkSync(config.tokenFile);
        // Restart
        process.exit(1);
    });

    socket.on('error',function() {
        setTimeout(function () {
            socket = io.connect(config.dojoHost);
        }, 1000);
        sendingData=false;
        setStateToError();
    });

    socket.on('disconnect', function () {
        // socket disconnected
        setTimeout(function () {
            socket = io.connect(config.dojoHost);
        }, 1000);
        sendingData=false;
        setStateToError();
    });
    socket.on('connect_failed', function () {
        sendingData=false;
        setStateToError();
        // socket cannot reconnect. Keep trying
        setTimeout(function () {
            socket = io.connect(config.dojoHost);
        }, 1000);
    });
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
    /*
    *   Receiving Data
    */
    var cmdOptions = {
        host: config.cloudHost,
        port: config.cloudPort,
        path: '/commands/'+nodedetails.id,
        method: 'GET',
        headers: {
            'X-Ninja-Token':nodedetails["token"]
        }
    }
    var longPollConn={};
    var longpoll = function(){
        if (longPollConn.end) longPollConn.end();
        longPollConn = http.get(cmdOptions, function (http_res) {
            http_res.on("data", function (data) {
                receivingData=true;
                setStateToOK();
                executeCommand(data);
            });
            http_res.on("end", function () {
                longpoll();
            });
            http_res.on("close", function () {
                longpoll();
            });
            http_res.on("error", function () {
                setTimeout(longpoll,5000)
            });

        }).on('error',function(err){
            console.log('Error in longpoll request: '+err);
            setTimeout(longpoll,5000);
            receivingData=false;
            setStateToError();
        });
    }

    var executeCommand = function(data){
        var data = sutil.getJSON(data);
        if (data && data.welcome) return;
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
    longpoll();
};
// main() -- basically
var sendingData = false;
var receivingData = false;
var currentState;
var setStateToOK = function() {
    if (sendingData && receivingData && currentState!=='ok') {
        changeLEDColor('green');
        currentState="ok";
    }
};

var setStateToError = function() {
    currentState='error';
    changeLEDColor('red');
};
/*
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
        if(ev.name == 'v4l'){console.log(ev.name + " was added.");}
      },
      delete: function(ev) {
        // Send the device removed message to teh server here 
        if(ev.name == 'v4l'){console.log(ev.name + " was removed.");}
      }
    };
}());
inotify.watch(directive, '/dev/');
*/
(function() {
    nodedetails["id"] = fs.readFileSync(config.serialFile).toString().replace(/\n/g,''); // TODO

    if (path.existsSync(config.tokenFile)) {
        // We're good to go
        nodedetails["token"] = fs.readFileSync(config.tokenFile).toString().replace(/\n/g,''); // TODO
        activatedState();
    }
    else {
        // Need to request a token
        activationRequiredState();
    }
})();