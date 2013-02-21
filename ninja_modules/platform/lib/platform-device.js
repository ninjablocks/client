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

	this.write = function(dat) {

		this.state = dat;
		var res = {
			
			DEVICE : [{

				V : this.V
				, G : this.G
				, D : this.D
				, DA : dat
			}]
		};
		this.emit('data', JSON.stringify(res));
	};
};


util.inherits(device, stream);
