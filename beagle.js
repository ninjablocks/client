var http = require('http');
var fs = require('fs');
var util = require('util');
// var qs = require('querystring');
// var child = require('child_process');
var sutil = require('./lib/client-utils');
var serialport = require("serialport");
var SerialPort = serialport.SerialPort;

var config =  {
    // cloudHost: 'ninj.herokuapp.com',
    // cloudPort: 80,
    // devtty: "/dev/ttyO1",
    // devtty: "/home/ubuntu/client/serialnumber",
    cloudHost : 'localhost',
    cloudPort : 3000,
    devtty    : "/dev/tty.usbserial-AE01AAE3",
    serialfile: "/Users/pete/work/ninj/client/serialnumber",
    heartbeat_interval: 500 
}    

var tty = new SerialPort(config.devtty, { 
    parser: serialport.parsers.readline("\n")
});

var nodedetails = {}
fs.readFile(config.serialfile,'ascii',function(err,data){
    nodedetails["id"] = data.replace(/\n/g,"")
})
nodedetails["token"] = "1234123412341234"; // TODO

var readings = {};
tty.on('data',function(data){
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
    hb = {  "NODE_ID":nodedetails.id,
            "TOKEN": nodedetails.token,
            "TIMESTAMP": null,
            "DEVICE":[] }
    hb.TIMESTAMP = new Date().getTime();
    for (r in readings) {
        hb.DEVICE.unshift(readings[r]);
    }
    // console.log(JSON.stringify(hb));
    return JSON.stringify(hb);
}

var postOptions = {
    host: config.cloudHost,
    port: config.cloudPort,
    path: '/heartbeats',
    method: 'POST',
    headers: { 'content-type': 'application/json'} 
}
var longPost = function(){
    var request = http.request(postOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Received a body: '+chunk);
        });
        res.on('end', function(){
            console.log('end: ');
            setTimeout(longPost,100);
        })
    });
    var sendBeats = setInterval(function(){
        request.write(getHeartbeat());
    },config.heartbeat_interval);
    setTimeout(function(){
        // restart connection after 120s
        clearInterval(sendBeats);
        request.end();
    },120000)
    // console.log('connection');
    request.on('error', function(){
        console.log('error: ');
        setTimeout(longPost,1000);
    });
}
longPost();

var options = {
    host: config.cloudHost,
    port: config.cloudPort,
    path: '/commands',
    method: 'GET'
}
var longpoll = function(){
    http.get(options, function (http_res) {
        http_res.on("data", function (data) {
            command(data);
        });
        http_res.on("end", function () {
            longpoll();
        });
        http_res.on("close", function () {
            longpoll();
        });
        http_res.on("error", function () {
            longpoll();
        });

    }).on('error',function(err){
        console.log('there was an error: '+err);
        setTimeout(longpoll,5000)
    });
}
longpoll();

var command = function(data){
    // Bodgy handle colour only 
    j = sutil.getJSON(data);
    if (j) {
        console.log('change color to: '+j.payload);
        sutil.rgb(tty,j.payload);
    }
}


process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + util.inspect(err,null,true,true));
});
