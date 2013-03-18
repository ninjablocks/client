/**
 * argv.js
 * client arguments & defaults
 */

var
	fs = require('fs')
	, path = require('path')
	, banner = fs.readFileSync(
		path.resolve(
			__dirname
			, 'banner'
		)
	)
	, defaults
	, argv
;

if (process.env.NODE_ENV === "development") {

	defaults = {

		cloudHost : "127.0.0.1"
		, streamHost : "127.0.0.1"
		, apiHost : "127.0.0.1"
		, logFile : path.resolve(process.env.PWD, 'ninjablock.log')
		, serialFile : path.resolve(process.env.PWD, 'serial-development.conf')
		, tokenFile : path.resolve(process.env.PWD, 'token-development.conf')
		, env : 'development'
		, streamPort : 3003
		, cloudPort : 3001
		, apiPort		: 3000
		, secure : false
	}
}
else if (process.env.NODE_ENV === "hacking") {

	defaults = {
		cloudHost : "zendo.ninja.is"
		, apiHost : "api.ninja.is"
		, streamHost : "stream.ninja.is"
		, logFile : path.resolve(process.env.PWD, 'ninjablock.log')
		, serialFile : path.resolve(process.env.PWD, 'serial-hacking.conf')
		, tokenFile : path.resolve(process.env.PWD, 'token-hacking.conf')
		, env : 'hacking'
		, streamPort : 443
		, cloudPort : 443
		, apiPort 	: 443
		, secure : true
	}
}
else {

	defaults = {

		cloudHost : "zendo.ninja.is"
		, streamHost : "stream.ninja.is"
		, apiHost : "api.ninja.is"
		, logFile : '/var/log/ninjablock.log'
		, serialFile : '/etc/opt/ninja/serial.conf'
		, tokenFile : '/etc/opt/ninja/token.conf'
		, env : 'production'
		, streamPort : 443
		, cloudPort : 443
		, apiPort		: 443
		, secure : true
	}
	if(!process.env.NODE_ENV) { process.env.NODE_ENV = "production"; }
}

argv = require('optimist')

	.usage(

		[	banner
			, "This process requires certain parameters to run."
			, "Please see usage information below."
			, ""
			, "Example: $0 --devicePath /dev/tty.usb*B"
		].join("\n")
	)
	.default(defaults)
	.argv
;

module.exports = argv;
