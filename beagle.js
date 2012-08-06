(function() {
    var fs = require('fs'),
        http = require('http'),
        path = require('path'),
        util = require('util'),
        exec = require('child_process').exec,
        utils = require(__dirname+'/lib/client-utils.js'),
        Inotify = require('inotify-plusplus'),
        serialport = require('serialport'),
        SerialPort = serialport.SerialPort,
        sendIv = 0,
        watchDogIv,
        rebootIv,
        inotify,
        directive,
        cameraIv,
        cameraGuid,
        config =  {
            nodeVersion:0.4,
            arduinoVersion:0.4,
            systemVersion:0.4,
            utilitiesVersion:0.4,
            cloudHost: 'daidojo.ninja.is',
            cloudStream: 'stream.ninja.is',
            cloudStreamPort: 443,
            cloudPort: 443,
            devtty: "/dev/ttyO1",
            serialFile: "/etc/opt/ninja/serial.conf",
            tokenFile: "/etc/opt/ninja/token.conf",
            updateLock: '/etc/opt/ninja/.has_updated',
            heartbeat_interval: 500,
            secure:true
        };
        config.id=fs.readFileSync(config.serialFile).toString().replace(/\n/g,'');

    console.log(utils.timestamp()+' Ninja Block Starting Up');
    // Development overwrites
    if (process.argv[2] == 'local') {
        config.cloudHost = process.argv[3];
        config.cloudPort = 3001;
        config.cloudStream = process.argv[3];
        config.cloudStreamPort = 3003;
        config.secure = false;
    };
    // Setup the TTY serial port
    var tty = new SerialPort(config.devtty, { 
        parser: serialport.parsers.readline("\n")
    });
    utils.configure(config,null,tty);
    // Connect
    var upnode = require('upnode');
    var proto = (config.secure) ? require('tls') : require('net');
    var connectionParams = {
        createStream:function () {
            return proto.connect(config.cloudPort, config.cloudHost);
        },
        block: function (remote, conn) {
            createUpListener();
            var params = {
                client:'beagle',
                id:config.id,
                version:{
                    node:config.nodeVersion,
                    arduino:config.arduinoVersion,
                    utilities:config.utilitiesVersion,
                    system:config.systemVersion
                }
            }
            var token = utils.fetchBlockToken();
            if (token) {
                utils.changeLEDColor('cyan');
                console.log(utils.timestamp()+' Connecting');
                remote.handshake(params, token, function (err, res) {
                    if (err) console.error(utils.timestamp()+" "+err);
                    else {
                        conn.emit('up', res)
                    }
                });
            } else {
                utils.changeLEDColor('purple');
                console.log(utils.timestamp()+' Awaiting Activation');
                remote.activate(params,function(err,token,res) {
                    if (err||!token) {
                        console.log(utils.timestamp()+" Error, Restarting");
                        process.exit(1);
                    } else {
                        console.log(utils.timestamp()+" Received Authorisation Codes");
                        fs.writeFileSync(config.tokenFile, token.token, 'utf8');
                        conn.emit('up',res);
                    }
                });
            }
        }
    };
    var clientHandlers = {
        revokeCredentials: function() {
            console.log(utils.timestamp()+" Invalid Token, rebooting");
            // Delete token
            fs.unlinkSync(config.tokenFile);
            // Restart
            process.exit(1);
        },
        execute: function(command,fn) {
            if (utils.executeCommand(command)) {
                fn(null);   // Executed successfully
            } else {
                fn(true);   // Error executing
            }
        },
        update: function(toUpdate) {
            console.log(utils.timestamp()+" Updating");
            if (typeof toUpdate !== "object"
                || !(toUpdate instanceof Array)) return false;
            else utils.updateCode(toUpdate);
        }
    };
    var up = upnode(clientHandlers).connect(connectionParams);
    var createUpListener = function() {
        up(function (remote) {
            utils.configure(config,remote,tty);
            utils.changeLEDColor('green');
            console.log(utils.timestamp()+' All Systems Go');
            tty.removeAllListeners('data');
            tty.on('data',function(data){
                utils.handleRawTtyData(data);
            });
            clearInterval(sendIv);
            sendIv = setInterval(function(){
                remote.heartbeat(utils.getHeartbeat());
            },config.heartbeat_interval); 
        });
    };
    var setStateToOK = function() {
        utils.changeLEDColor('green');
    };
    var setStateToError = function() {
        utils.changeLEDColor('red');
    };
    // Camera
    inotify = Inotify.create(true); // stand-alone, persistent mode, runs until you hit ctrl+c
    directive = (function() {
        return {
          create: function (ev) {
            if(ev.name == 'v4l'){
                cameraGuid = utils.buildDeviceGuid(config.id,{G:"0",V:0,D:1004});
                clearInterval(cameraIv);
                cameraIv = setInterval(function() {
                    utils.readings[cameraIv] = {
                        GUID:cameraGuid,
                        G:"0",
                        V:0,
                        D:1004,
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
        var stats = fs.lstatSync('/dev/video0');
        // Is it a directory?
        if (stats.isCharacterDevice()) {
            // Yes it is
            console.log(utils.timestamp()+" Camera is Connected");
            cameraGuid = utils.buildDeviceGuid(config.id,{G:"0",V:0,D:1004});
            cameraIv = setInterval(function() {
                utils.readings[cameraIv] = {
                    GUID:cameraGuid,
                    G:"0",
                    V:0,
                    D:1004,
                    DA:1
                };
            },config.heartbeat_interval);
        }
    }
    catch (e) {
        console.log(utils.timestamp()+" Camera Not Present");
    }
    // Watdog Timer
    var watchDogStream = fs.open('/dev/watchdog','r+',function(err,fd) {
        if (err) console.log(utils.timestamp()+" "+err);
        var watchDogPayload = new Buffer(1);
        watchDogPayload.write('\n','utf8');
        watchDogIv = setInterval(function() {
            fs.write(fd,watchDogPayload,0, watchDogPayload.length, -1,function(err) {
                if (err) console.log(utils.timestamp()+" "+err);
            });
        },30000);
        utils.watchDogIv=watchDogIv;
    });
    // Process event handlers
    process.on('exit',function() {
        utils.changeLEDColor('yellow');
    });
    process.on('SIGINT',function() {
        // Ctrl + C
    });
    process.on('uncaughtException',function() {
        // Unknown error
        process.exit(1);
    });
})();