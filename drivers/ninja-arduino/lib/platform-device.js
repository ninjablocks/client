var
	stream = require('stream')
	, util = require('util')
;

module.exports = device;

function device(G, V, D) {
	
	
	if(!D) { return false; }
	
	stream.call(this);

	this.V = parseInt(V) || 0;
	this.G = G.toString() || "0";
	this.D = parseInt(D) || undefined;

	this.write = function(dat) {

		this.state = dat.toString();
		var res = {
			
			DEVICE : [{

				V : this.V
				, G : this.G
				, D : this.D
				, DA : this.state 
			}]
		};
		this.emit('data', JSON.stringify(res));
	};

	this.end = function() {

		this.emit('end');
	}
};


util.inherits(device, stream);
