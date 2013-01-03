var
	path = require('path')
	, util = require('util')
	, Device = require(__dirname, '..', 'device')
;

function embedded(opts, app) {
	
	var 
		opts = opts || {}
		, log = app.log
	;

	return this;

};

util.inherits(embedded, Device);

module.exports = embedded;
