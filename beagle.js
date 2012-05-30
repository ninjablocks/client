
var http = require('http');
var fs = require('fs');
var util = require('util');
var qs = require('querystring');
var child = require('child_process');

var cloudHost = 'ninj.herokuapp.com';
var cloudPort = 80;
var cloudHost = '10.1.1.12';
var cloudPort = 3000;

var getNodeId = function(){ return "NBABB-123BB123" };
var getTokenId = function() { return "1234123412341234"};

var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var tty = new SerialPort("/dev/ttyO1", { 
    // Emit data events on newline chars
    parser: serialport.parsers.readline("\n")
});
    
var postOptions = {
    host: cloudHost,
    port: cloudPort,
    path: '/heartbeats',
    method: 'POST',
    headers: { 'content-type': 'application/json'}
}


var firehose = function(){
    var hb_req = http.request(postOptions, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('oops, got a body: '+chunk);
        });
    }); 
    hb_req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        // wait 2 seconds and retry
        firehose();
    });
    hb_req.on('close', function() {
        firehose();
    });
    hb_req.on('end', function() {
        firehose();
    });
    hb_req.on('socket',function(){
        // Start reading from serial when the connection is up
        tty.on("data", function (data) {
            if (isJSON(data)) {
                if (hb_req.connection.writable) {
                    hb_req.write(wrapMsg(JSON.parse(data)));
                } else {
                    console.log('connection down');
                }
            }
        });
    });
}
firehose();


var wrapMsg = function(chunk) {
    var nm = { "NODE_ID" : getNodeId(), "TOKEN" : getTokenId(), "DEVICE" : chunk.DEVICE }
    for (var x=0; x<nm.DEVICE.length; x++) {
        nm.DEVICE[x].G = nm.NODE_ID+'-'+nm.DEVICE[x].G;
    }
    return JSON.stringify(nm);    
};


var options = {
    host: cloudHost,
    port: cloudPort,
    path: '/commands',
    method: 'GET'
}

http.get(options, function (http_res) {
    http_res.on("data", function (chunk) {
        var p = JSON.parse(chunk);  
        var command = { "DEVICE": [{
            "G":"NIL", "V":0, "D":1000, "DA":p.payload
        }]} 
        console.log(JSON.stringify(command));
        tty.write(JSON.stringify(command));
    });
    http_res.on("end", function () {

    });
});


var options = {
    host: cloudHost,
    port: cloudPort,
    path: '/commands',
    method: 'GET'
}

var isJSON = function(data) { 
    try { JSON.parse(data) } catch (e) { return false } return true
}

var longpoll = function(){
    http.get(options, function (http_res) {
        http_res.on("data", function (chunk) {
            if (isJSON(chunk)) {
                color = JSON.parse(chunk).payload;
                console.log("Changing color to "+color);
                tty.write('{"DEVICE": [{"G": "NIL","V": 0,"D": 1000,"DA": "'+color+'"}]}')
            } else {
                // Uncomment for server error
                // console.log(chunk.toString());  
            }
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
        setTimeout(longpoll,2000)
    });
}

longpoll();


var fakeTTY = function(e) { 
    fs.readFile('/Users/pete/work/ninj/tmp/sample_cape_json.txt', 'utf8', function(err,data){
        if (err) throw err;
        var lines = data.split('\n');
        for (var i=0; i<lines.length; i++) {
            req.write(wrapMsg(lines[i]));
        }
        req.end();
    });
};

// fakeTTY();

// Node is one weird... thing.
/*
child.exec("xxd -g 2 -a -l 16 -seek 16 /sys/bus/i2c//devices/1-0050/eeprom | sed 's/^.* //' | sed -e 's/[.]//g'",
           function(err,bid,ee) {
              if (err) {
                console.log("E: " + err);
              }
              if (bid) {
                stream = fs.createReadStream('/dev/ttyO1');
                stream.setEncoding('utf8');
                stream.on('end', function(close) { null; }); 
                stream.on('data',function(dat) {

                  try {
                    fx = JSON.parse(dat);
                    if (!fx.temperature) {
                        throw("Ack");
                    }
                    isok = dat;
                    var tbid = bid.replace(/\n$/,"");
                    var tosend = dat.replace(/\n$/,"");

                    var postdata = qs.stringify({
                        blockid: tbid, 
                        blockdata: tosend
                    });

                    var pops = {
                        host: "192.168.0.104",
                        port: 5000,
                        path: "/update",
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded",
                                   "Content-Length": postdata.length }
                    };

                    var req = http.request(pops, function(res) {
                        res.on('data',function(c){ console.log("Res: " + c); });
                    });

                    req.on('error',function(e) { console.log("H: " + e); });
                    req.write(postdata + "\n");
                    req.end();

                  } catch (e) { null; }
                });
              }
           });
*/