
var BufferMaker = require('buffermaker');


var msg = new BufferMaker();
msg.Int16LE(46110);
var buffer = msg.make();

console.log(buffer.toString());
