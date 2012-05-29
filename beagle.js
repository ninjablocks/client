
var http = require('http');
var fs = require('fs');
var util = require('util');
var qs = require('querystring');
var child = require('child_process');
var serial_number = 
// Data dump url info.

// Node is one weird... thing.
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
                        path: "/dump",
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
