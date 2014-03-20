// This allows lamps to pair with new basestations.
// See :http://www.everyhue.com/?page_id=38#/discussion/92/link-your-living-colors-and-hue-bulbs-from-other-starter-pack-without-a-remote

var net = require('net');

var socket = net.createConnection(30000, '10.0.1.92');
console.log('Socket created.');
socket.on('data', function(data) {
  console.log('RESPONSE: ' + data);
}).on('connect', function() {
  socket.write("[Link,Touchlink]");
}).on('end', function() {
  console.log('DONE');
});
