var http = require('http');
var fs = require('fs');
var util = require('util');
// var qs = require('querystring');
// var child = require('child_process');
var sutil = require('./lib/client-utils');
var serialport = require("serialport");
var SerialPort = serialport.SerialPort;

// base config for beagle
var config =  {
    dojoHost: '',
    dojoPort:3000,
    cloudHost: 'ninj.herokuapp.com',
    cloudPort: 80,
    devtty: "/dev/ttyO1",
    serialFile: "/utilities/etc/serial.conf",
    tokenFile: "/utilities/etc/token.conf",
    heartbeat_interval: 500
}    
// commandline config overwrites
if (process.argv[2] == 'local') {
    config.dojoHost = 'localhost';
    config.dojoPort = '3001';
    config.cloudHost = 'localhost';
    config.cloudPort = 3000;
}
if (process.argv[3] == 'ftdi') {
    config.devtty = "/dev/tty.usbserial-AE01AAE3";
    config.serialFile = __dirname+"/serialnumber";
    config.tokenFile = __dirname+"/token";

}
console.log(config);

/*
*   Serial Port Stuff
*/

var tty = new SerialPort(config.devtty, { 
    parser: serialport.parsers.readline("\n")
});

var nodedetails = {}
nodedetails["id"] = fs.readFileSync(config.serialFile).toString().replace(/\n/g,''); // TODO
nodedetails["token"] = fs.readFileSync(config.tokenFile).toString().replace(/\n/g,''); // TODO

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


/*
*   Sending Data
*/
var net = require('net');
var stream = net.createConnection(config.dojoPort, config.dojoHost);
stream.on('error', function (err) {
    clearInterval(sendIv);
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
        console.log("Connection refused, retrying...")        
        setTimeout(function () {
            stream.connect(config.dojoPort,config.dojoHost);
        }, 1000);
    }
});

stream.on('end', function () {
    clearInterval(sendIv);
    console.log('Reconnecting...');
    setTimeout(function () {
        stream.connect(config.dojoPort,config.dojoHost);

    }, 1000);
});
var sendIv = 0;
stream.on('connect',function(socket) {
    console.log('Connected')
    clearInterval(sendIv);
    sendIv = setInterval(function(){
        // Only send empty heartbeats every 10s
        // TODO reduce frequency of identical heartbeats
        if (beatThrottle.isGoodToGo()) {
            var heartBeart = getHeartbeat();
            stream.write(heartBeart+'\n');
        } 
    },config.heartbeat_interval);
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
var longPost = function(){
    var request = http.request(postOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('LongPost received a body: '+chunk);
        });
        res.on('end', function(){
            setTimeout(longPost,100);
        })
    });
    var sendBeats = setInterval(function(){
        // Only send empty heartbeats every 10s
        // TODO reduce frequency of identical heartbeats
        if (beatThrottle.isGoodToGo()) {
            request.write(getHeartbeat());
        } 
    },config.heartbeat_interval);

    setTimeout(function(){
        // restart connection after 120s
        clearInterval(sendBeats);
        request.end();
    },120000)
    // console.log('connection');
    request.on('error', function(e){
        console.log('Longpost Error: '+e);
        setTimeout(longPost,1000);
    });
}
longPost();
*/
/*
*   Receiving Data
*/
var cmdOptions = {
    host: config.cloudHost,
    port: config.cloudPort,
    path: '/commands/'+nodedetails.id,
    method: 'GET'
}
var longpoll = function(){
    http.get(cmdOptions, function (http_res) {
        http_res.on("data", function (data) {
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
        setTimeout(longpoll,5000)
    });
}

var executeCommand = function(data){
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
/*
process.on('uncaughtException', function (err) {
  // console.log('Caught Uncaught Exception: ' + util.inspect(err,null,true,true));
});
*/