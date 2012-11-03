/**
 * argv.js 
 * client arguments & defaults
 */

var 
	path = require('path')
	, defaults 
	, argv
;

if(process.env.NODE_ENV == "development") {

	defaults = {

		cloudHost : "127.0.0.1"
		, streamHost : "127.0.0.1"
		, logFile : path.resolve(process.env.PWD, 'client.log')
		, env : 'development'
		, streamPort : 3003
		, cloudPort : 3001
		, secure : false
	}
}
else {

	defaults = {

		cloudHost : "zendo.ninja.is"
		, streamHost : "stream.ninja.is"
		, logFile : '/var/log/client.log'
		, env : 'production'
		, streamPort : 443
		, cloudPort : 443
		, secure : true
	}
}

argv = require('optimist')

	.usage(

		[
			"Usage: $0 --device <path>"
			, "--token <token>"
			, "--cloudHost <hostname>"
			, "--streamHost <hostname>"
			, "--cloudPort [port]"
			, "--streamPort [port]"
			, "--secure [bool]" 
			, "--logFile [path]"
		].join(" ")
	)
	.demand(

		[
			"device"
			, "cloudHost"
			, "cloudStream" 
		]
	)
	.default(defaults)
	.argv
;

module.exports = argv;
