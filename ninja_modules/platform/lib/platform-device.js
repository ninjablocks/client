var
	stream = require('stream')
	, util = require('util')
;

module.exports = device;

function device(G, V, D) {
	
	
	if(!D) { return false; }
	
	stream.call(this);

	this.V = V || 0;
	this.G = G || "0";
	this.D = D || undefined;

};

util.inherits(device, stream);
