(function() {
    var fs = require('fs'),
        http = require('http'),
        path = require('path'),
        util = require('util'),
        exec = require('child_process').exec,
        utils = require(__dirname+'/lib/client-utils.js'),
        Inotify = require('inotify-plusplus'),
        io = require('socket.io-client'),
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
            version:0.1,
            cloudHost: 'dojo.ninja.is',
            cloudStream: 'stream.ninja.is',
            cloudStreamPort: 443,
            cloudPort: 443,
            devtty: "/dev/ttyO1",
            serialFile: "/etc/opt/ninja/serial.conf",
            tokenFile: "/etc/opt/ninja/token.conf",
            updateLock: '/etc/utilities/tmp/.has_updated',
            heartbeat_interval: 500,
            secure:true
        },
        ioOpts = {
            'port':config.cloudPort,
            'transports':['xhr-polling'],
            'try multiple transports':false,
            'secure':config.secure
        };
        config.id=fs.readFileSync(config.serialFile).toString().replace(/\n/g,'');
        config.token=(path.existsSync(config.tokenFile))
                    ?fs.readFileSync(config.tokenFile).toString().replace(/\n/g,'')
                    :false;

    console.log(utils.timestamp()+' Ninja Block Starting Up');
    // Development overwrites
    if (process.argv[2] == 'local') {
        config.cloudHost = process.argv[3];
        config.cloudStream = process.argv[3];
        config.cloudStreamPort = 3003;
        ioOpts["port"] = 3001;
        ioOpts.secure = false;
    };
    // Setup the TTY serial port
    var tty = new SerialPort(config.devtty, { 
        parser: serialport.parsers.readline("\n")
    });
    // Connect
    var socket = io.connect(config.cloudHost,ioOpts);
    // Configure the helper library
    utils.configure(config,socket,tty);
    // TTY data handler
    tty.on('data',function(data){
        utils.handleRawTtyData(data);
    });
    // Various network handlers
    socket.on('connecting',function(transport){
        console.log(utils.timestamp()+" Connecting");
        utils.changeLEDColor('cyan');
    });
    socket.on('connect',function() {
        clearTimeout(rebootIv);
        console.log(utils.timestamp()+" Connected");
        console.log(utils.timestamp()+" Authenticating");
        socket.emit('hello',config.id);
    });
    socket.on('error',function(err) {
        console.log(err);
        console.log(utils.timestamp()+" Socket error, restarting.")
        setStateToError();
        clearTimeout(rebootIv);
        rebootIv = setTimeout(function() {
            process.exit(1);
        },30000);
    });
    socket.on('disconnect', function () {
        console.log(utils.timestamp()+" Disconnected, restarting.")
        setStateToError();
        clearTimeout(rebootIv);
        rebootIv = setTimeout(function () {
            process.exit(1);
        },30000);
    });
    socket.on('reconnecting',function() {
        console.log(utils.timestamp()+" Reconnecting");
        utils.changeLEDColor('cyan');
    });
    socket.on('reconnect_failed',function() {
        console.log(utils.timestamp()+" Reconnect failed, restarting.");
        setStateToError();
        clearTimeout(rebootIv);
        rebootIv = setTimeout(function () {
            process.exit(1);
        },30000);
    });
    socket.on('whoareyou',function() {
        if (config.token) {
            socket.emit('iam',{client:'beagle',version:config.version,token:config.token});
        } else {
            console.log(utils.timestamp()+' Awaiting Activation');
            utils.changeLEDColor('purple');
            socket.emit('notsure',{client:'beagle',version:config.version});
            socket.on('youare',function(token) {
                console.log(utils.timestamp()+" Received Authorisation")
                fs.writeFileSync(config.tokenFile, token.token, 'utf8');
                config.token = token.token;
                socket.emit('iam',{client:'beagle',version:config.version,token:config.token});
            });
        }
    });
    socket.on('begin',function() {
        console.log(utils.timestamp()+" Authenticated");
        console.log(utils.timestamp()+" Sending/Receiving");
        clearInterval(sendIv);
        sendIv = setInterval(function(){
            if (socket.socket.buffer.length==0) {
                socket.emit('heartbeat',utils.getHeartbeat());
            } 
        },config.heartbeat_interval);    
        setStateToOK();
    });
    socket.on('command',function(data) {
        console.log(utils.timestamp()+" "+data);
        utils.executeCommand(data);
    });
    socket.on('invalidToken',function() {
        console.log(utils.timestamp()+" Invalid Token, rebooting");
        // Delete token
        fs.unlinkSync(config.tokenFile);
        // Restart
        process.exit(1);
    });
    socket.on('updateYourself',function(toUpdate) {
        console.log(utils.timestamp()+" Updating");
        if (typeof toUpdate !== "object"
            || !(toUpdate instanceof Array)) return false;
        else utils.updateCode(toUpdate);
    });
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
        console.log(utils.timestamp()+" Camera Error");
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
    });
    // Process event handlers
    process.on('exit',function() {
        utils.changeLEDColor('yellow');
    });
})();