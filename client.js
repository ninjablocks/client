var
	fs = require('fs')
	, path = require('path')
	, util = require('util')
	, stream = require('stream')
	, argv = require(path.resolve(__dirname, 'app', 'argv'))
	, ninja = require(path.resolve(__dirname, 'app', 'client'))
	, config = require(path.resolve(__dirname, 'app', 'config'))
	, logger = require(path.resolve(__dirname, 'lib', 'logger'))
	, log = new logger(argv).log
	, client = new ninja(argv)
;

logger.default = log;

