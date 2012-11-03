var
	fs = require('fs')
	, path = require('path')
	, util = require('util')
	, stream = require('stream')
	, exec = require('child_process').exec
	, serialport = require('serialport').SerialPort
	, argv = require(path.resolve(__dirname, 'app', 'argv'))
	, logger = new require(path.resolve(__dirname, 'lib', 'logger'))({

		env : argv.env
		, logFile : argv.logFile
	})
;

var client = function client(opts) {

};
