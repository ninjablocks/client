(function() {
    console.log('Ninja Block Starting Up');

    var fs = require('fs'),
        path = require('path'),
        util = require('util'),
        http = require('http'),
        io = require('socket.io-client'),
        serialport = require('serialport'),
        SerialPort = serialport.SerialPort,
        emptyBeats = 0,
        sendIv = 0,
        instantContainer = {},
        readings = {},
        config =  {
            cloudHost: 'staging-dojo.ninja.is',
            cloudPort: 443,
            devtty: "/dev/ttyO1",
            serialFile: "/etc/opt/ninja/serial.conf",
            tokenFile: "/etc/opt/ninja/token.conf",
            heartbeat_interval: 500,
            secure:true
        },
        ioOpts = {
            'port':config.cloudPort,
            'transports':['xhr-polling'],
            'try multiple transports':false,
            'secure':config.secure
        },
        nodedetails = {
            id:fs.readFileSync(config.serialFile).toString().replace(/\n/g,'')
        },
        sutil = require('./lib/client-utils');
        sutil.configure(config);

    // Try and fetch the token
    nodedetails.token = (path.existsSync(config.tokenFile)) 
                        ? fs.readFileSync(config.tokenFile).toString().replace(/\n/g,'') 
                        : false;
    // development overwrites
    if (process.argv[2] == 'local') {
        config.cloudHost = process.argv[3];
        ioOpts["port"] = 3001;
        ioOpts.secure = false;
    };
    // Connect
    var socket = io.connect(config.cloudHost,ioOpts);
    // Various
    socket.on('connecting',function(transport){
        console.log("Connecting");
        sutil.changeLEDColor(tty,'cyan');
    });
    socket.on('connect', function () {
        console.log("Connected");
        console.log("Authenticating");
        socket.emit('hello',nodedetails.id);
    });
    socket.on('error',function(err) {
        console.log(err);
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
    socket.on('reconnecting',function() {
        console.log("Reconnecting");
        sutil.changeLEDColor(tty,'cyan');
    });
    socket.on('reconnect_failed',function() {
        console.log("Reconnect failed, retrying");
        setStateToError();
        setTimeout(function () {
            socket = io.connect(config.cloudHost);
        }, 1000);
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
    socket.on('begin',function() {
        console.log("Authenticated");
        console.log("Sending/Receiving...");
        clearInterval(sendIv);
        sendIv = setInterval(function(){
            if (beatThrottle.isGoodToGo() && socket.socket.buffer.length==0) {
                socket.emit('heartbeat',getHeartbeat());
            } 
        },config.heartbeat_interval);    
        setStateToOK();
    });
    socket.on('command',function(data) {
        console.log(data);
        executeCommand(data);
    });
    socket.on('invalidToken',function() {
        console.log("Invalid Token, rebooting");
        // Delete token
        fs.unlinkSync(config.tokenFile);
        // Restart
        process.exit(1);
    });
    // Setup the TTY serial port
    var tty = new SerialPort(config.devtty, { 
        parser: serialport.parsers.readline("\n")
    });
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
            device.GUID = sutil.buildDeviceGuid(nodedetails.id,device);
            // If we have meta data about the device, handle it.
            if (sutil.deviceHasMetaData(device)) {
                var meta = sutil.getDeviceMetaData(device);
                if (meta.instant) trySendInstantData(device);
            }
            // Add the devices data to the heartbeat container
            readings[deviceDataPoints[i].GUID] = deviceDataPoints[i];
        }
    };
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
                var guid = ds[d].GUID;
                delete ds[d].GUID;
                ds[d].G = ds[d].G.toString(); //TODO get JP to fix for 0
                switch(ds[d].D) {
                    case 1003: 
                        // Take picture
                        sutil.takePicture(guid,nodedetails.token);
                    break;
                    case 1004: 
                        // Take stream
                        sutil.sendCameraStream(guid,nodedetails.token);
                    break;
                    default:
                        sutil.writeTTY(tty,'{"DEVICE":['+JSON.stringify(ds[d])+']}');
                    break;
                }
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
    process.on('exit',function() {
        sutil.changeLEDColor(tty,'yellow');
    });

    var Inotify = require('inotify-plusplus'), // should be 'inotify++', but npm has issues with the ++
        inotify,
        directive,
        options,
        cameraIv,
        cameraGuid;

    inotify = Inotify.create(true); // stand-alone, persistent mode, runs until you hit ctrl+c
    directive = (function() {
        return {
          create: function (ev) {
            if(ev.name == 'v4l'){
                cameraGuid = sutil.buildDeviceGuid(nodedetails.id,{G:"0",V:0,D:1003});
                clearInterval(cameraIv);
                cameraIv = setInterval(function() {
                    readings[cameraIv] = {
                        GUID:cameraGuid,
                        G:"0",
                        V:0,
                        D:1003,
                        DA:1
                    };
                },config.heartbeat_interval);
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
        stats = fs.lstatSync('/dev/video0');
        // Is it a directory?
        if (stats.isCharacterDevice()) {
            // Yes it is
            console.log("Camera is connected");
            cameraGuid = sutil.buildDeviceGuid(nodedetails.id,{G:"0",V:0,D:1003});
            cameraIv = setInterval(function() {
                readings[cameraIv] = {
                    GUID:cameraGuid,
                    G:"0",
                    V:0,
                    D:1003,
                    DA:1
                };
            },config.heartbeat_interval);
        }
    }
    catch (e) { }
})();