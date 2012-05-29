
var http = require('http');
var fs = require('fs');
var util = require('util');
var qs = require('querystring');
var child = require('child_process');

var getNodeId = function(){ return "NBABB-123BB123" };
var getTokenId = function() { return "1234123412341234"};
    
var options = {
    host: 'localhost',
    port: 3000,
    path: '/heartbeats',
    method: 'POST',
    headers: { 'content-type': 'application/json'}
}
    
var req = http.request(options, function(res) {
  console.log('STATUS: ' + res.statusCode);
  console.log('HEADERS: ' + JSON.stringify(res.headers));
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    console.log('BODY: ' + chunk);
  });
}); 

req.on('error', function(e) {
  console.log('problem with request: ' + e.message);
});

var wrapMsg = function(chunk) {
    var parsedchunk = JSON.parse(chunk);
    var nm = { "NODE_ID" : getNodeId(), "TOKEN" : getTokenId(), "DEVICE" : parsedchunk.DEVICE }
    for (var x=0; x<nm.DEVICE.length; x++) {
        nm.DEVICE[x].G = nm.NODE_ID+'-'+nm.DEVICE[x].G;
    }
    return JSON.stringify(nm);    
};

var streamTTY = function(e) { 
    fs.readFile('/Users/pete/work/ninj/tmp/sample_cape_json.txt', 'utf8', function(err,data){
        if (err) throw err;
        var lines = data.split('\n');

        for (var i=0; i<lines.length; i++) {
            // var parsed_line = JSON.parse(lines[i]);
            // var nm = { "NODE_ID" : getNodeId(), "TOKEN" : getTokenId(), "DEVICE" : parsed_line.DEVICE }
            // for (var x=0; x<nm.DEVICE.length; x++) {
            //     nm.DEVICE[x].G = nm.NODE_ID+'-'+nm.DEVICE[x].G;
            // }
            req.write(wrapMsg(lines[i]));
            // req.write(JSON.stringify(nm));
        }
        req.end();
    });
};

streamTTY();
// console.log(util.inspect(req));

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