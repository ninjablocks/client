var fs = require('fs'),
    http = require('http'),
    path = require('path'),
    util = require('util'),
    exec = require('child_process').exec,
    child_process = require('child_process'),
    utils = require(__dirname+'/lib/client-utils.js'),
    serialport = require('serialport'),
    SerialPort = serialport.SerialPort,
    sendIv = 0,
    rebootIv,
    tty,
    config =  {
        client:'beagle',
        nodeVersion:0.9,
        cloudHost: 'zendo.ninja.is',
        cloudStream: 'stream.ninja.is',
        cloudStreamPort: 443,
        cloudPort: 443,
        devtty: "/dev/ttyO1",
        locksDir: "/etc/opt/ninja",
        serialFile: "/etc/opt/ninja/serial.conf",
        tokenFile: "/etc/opt/ninja/token.conf",
        updateLock: '/etc/opt/ninja/.has_updated',
        heartbeat_interval: 5000,
        secure:true
    };
    config.id=fs.readFileSync(config.serialFile).toString().replace(/\n/g,'');
    config.utilitiesVersion=(path.existsSync('/opt/utilities/version'))
        ? parseFloat(fs.readFileSync('/opt/utilities/version'))
        : 0.4;
    config.systemVersion=(path.existsSync('/opt/utilities/sys_version'))
        ? parseFloat(fs.readFileSync('/opt/utilities/sys_version'))
        : 0.4;

console.log(utils.timestamp()+' Ninja Block Starting Up');

/*
    Fetch the arduino model and version
 */
child_process.execFile('/opt/utilities/bin/fetch_arduino_version',function(code,stdout,stderr) {
    if (stdout && stdout.indexOf('_')>-1) {
        var parts = stdout.split('_');
        config.arduinoModel = parts[0];
        config.arduinoVersion = parseFloat(parts[1]);
    } else if (stdout && stdout.length>0) {
        config.arduinoModel = 'V11';
        config.arduinoVersion = 0.36
    }
});
// We give 3 seconds to try and grab the arduino version
setTimeout(function() {
    // Setup the TTY serial port
    tty = new SerialPort(config.devtty, {
        parser: serialport.parsers.readline("\n")
    });
    utils.configure(config,tty);
    var up = upnode(clientHandlers).connect(connectionParams);
    up.on('up',function (remote) {
        utils.initRemote(remote);
        utils.changeLEDColor('green');
        console.log(utils.timestamp()+' All Systems Go');
    });
    up.on('reconnect',function() {
        utils.changeLEDColor('cyan');
        console.log(utils.timestamp()+' Reconnecting');
    });
},5000);

// Development overwrites
if (process.argv[2] == 'local') {
    config.cloudHost = process.argv[3];
    config.cloudPort = 3001;
    config.cloudStream = process.argv[3];
    config.cloudStreamPort = 3003;
    config.secure = false;
};

// Connect
// up down reconnect reconnect reconnect up
var upnode = require('upnode');
var proto = (config.secure) ? require('tls') : require('net');
var connectionParams = {
    ping:10000,
    timeout:5000,
    reconnect:2000,
    createStream:function () {
        return proto.connect(config.cloudPort, config.cloudHost);
    },
    block: function (remote, conn) {
        var params = utils.fetchBlockParams();
        var token = utils.fetchBlockToken();
        console.log(params);
        if (token) {
            remote.handshake(params, token, function (err, res) {
                if (err) console.error(utils.timestamp()+" "+err);
                else {
                    conn.emit('up',res);
                }
            });
            console.log(utils.timestamp()+' Connecting');
        } else {
            remote.activate(params,function(err,auth) {
                if (err||!auth) {
                    console.log(utils.timestamp()+" Error, Restarting");
                    process.exit(1);
                    return;
                }
                console.log(utils.timestamp()+" Received Authorisation, Confirming");
                fs.writeFile(config.tokenFile, auth.token, 'utf8',function(err) {
                    exec('sync');   // TODO: fsyncSync
                    if (err) throw err;
                    params.token=auth.token;
                    remote.confirmActivation(params,function(err) {
                        if (err) {
                            console.log(utils.timestamp()+" Error pairing block.")
                            console.log(utils.timestamp()+" "+err.error);
                            if (err.id===409) utils.changeLEDColor('blue');
                            fs.unlinkSync(config.tokenFile);
                        } else {
                            console.log(utils.timestamp()+" Confirmed Authorisation, Restarting");
                        }
                        process.exit(1);
                    });
                });
            });
            utils.changeLEDColor('purple');
            console.log(utils.timestamp()+' Awaiting Activation');
        }
    }
};
var clientHandlers = {
    revokeCredentials: function() {
        console.log(utils.timestamp()+" Invalid Token, Restarting");
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

 /*
// Process event handlers
process.on('exit',function() {
    utils.changeLEDColor('yellow');
});
process.on('SIGINT',function() {
    // Ctrl + C
});
process.on('uncaughtException',function(err) {
    // Unknown error
    console.log(err);
    process.exit(1);
});
*/
