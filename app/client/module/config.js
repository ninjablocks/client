module.exports = config;

/**
 * Remote config request (from cloud)
 */
function config(dat, cb) {

	if(!dat.CONFIG || !dat.id) { return; }

	var 
		cloudBuffer = {

			configResponse : { 

				CONFIG : [ ]
				, id : dat.id
			}
			, requested : 0
			, responded : 0
			, timeout : undefined
		}
		, ninja = this

	;

	dat.CONFIG.map(processRequest.bind(this));

	/**
	 * Called for each config element in the request
	 */
	function processRequest(req) {

		var ninja = this;

		if(req.type !== "MODULE") { // We only implement MODULE

			return;
		}

		if(!req.module) { // probe the bloke~!

			// we may want to add filtering of "system" modules from the probes?
			return blockProbe(req, dat.id);
		}

		moduleProbe(req, dat.id);		
	};

	function blockProbe(req, id) {


		if(!ninja.modules) { return; }
		var mods = Object.keys(ninja.modules);
		cloudBuffer.timeout = setTimeout(sendResponse, 3000);
		cloudBuffer.requested = mods.length;

		ninja.log.debug("cloudConfig: Initiating requests for %s modules", mods.length);
		mods.map(sendRequest);
		function sendRequest(mod) {

			if((ninja.modules[mod] && ninja.modules[mod].config)) {

				ninja.log.debug("cloudConfig: Requesting config from %s", mod);
				ninja.modules[mod].config(req.data || null, function(err, res) {

					ninja.log.debug("cloudConfig: Received response from %s", mod);
					configResponse(err, res, mod);
				});
			}
		};

		return ninja.log.debug("cloudConfig: Cloud requesting block config");		
	};

	function moduleProbe(req, id) {

		ninja.log.info(

			"cloudConfig: Attempting request (%s:%s)"
			, req.module
			, id
		);
		cloudBuffer.requested = 1;
		ninja.modules[req.module].config(req.data || { }, function(err, dat) {

			configResponse(err, dat, req.module); 
		});
	};

	function configResponse(err, res, mod) {

		if(!cloudBuffer.configResponse.CONFIG) {

			cloudBuffer.configResponse.CONFIG = [ ];
		}
		// error in module configResponse
		if(err) {

			// what to do here? 
			return ninja.log.error(

				"cloudConfig: %s (%s:%s)"
				, err
				, mod
				, dat.id
			);
		}
		ninja.log.debug("cloudConfig: Pushing module response (%s) onto stack", mod);
		cloudBuffer.configResponse.CONFIG.push({

			type : "MODULE"
			, module : mod
			, data : res
		})
		if(++cloudBuffer.responded >= cloudBuffer.requested) {

			sendResponse();
		}
	};	

	function sendResponse() {

		ninja.log.debug("cloudConfig: sending config collection");
		ninja.cloud.config(cloudBuffer.configResponse);
	}		
};
