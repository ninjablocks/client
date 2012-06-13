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
    serialFile: "/utilities/etc/serial.conf",
    tokenFile: "/utilities/etc/token.conf",
    heartbeat_interval: 500
};
var nodedetails = {};
// commandline config overwrites
if (process.argv[2] == 'local') {
    config.dojoHost = '10.10.0.35';
    config.dojoPort = '3001';
    config.cloudHost = '10.10.0.35';
    config.cloudPort = 3000;
}
if (process.argv[3] == 'ftdi') {
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
    
    var readings = {};
    tty.on('data',function(data){
         //console.log(data); // the almost raw serial data
        var nm = sutil.getJSON(data) || false;
        if (nm) {
            // only keep latest reading per device between heartbeats
            for (var x=0; x<nm.DEVICE.length; x++) {
                nm.DEVICE[x].GUID = nodedetails.id+'_'+nm.DEVICE[x].G+'_'+nm.DEVICE[x].V+'_'+nm.DEVICE[x].D;
                readings[nm.DEVICE[x].GUID] = nm.DEVICE[x];
            }
        }
    });

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
            delete readings[r];
        }
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
        changeLEDColor('cyan');
    });
    socket.on('connect', function () {
        console.log("Connected");
        sendingData=true;
        setStateToOK();
        clearInterval(sendIv);
        sendIv = setInterval(function(){
            if (beatThrottle.isGoodToGo()) {
                socket.send(getHeartbeat());
            } 
        },config.heartbeat_interval);
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
    /*
    socket.on('connect_failed', function () {

        // socket cannot reconnect. Keep trying
        setTimeout(function () {
            socket = io.connect(config.dojoHost);
        }, 1000);
    });
    */
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
        method: 'GET'
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
        if (data.welcome) return;
        var ds = sutil.getJSON(data).DEVICE;
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