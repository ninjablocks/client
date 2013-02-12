module.exports = config;

/**
 * Remote config request (from cloud)
 */
function config(dat, cb) {

	if(!dat.CONFIG || !dat.id) { return; }
	var res = {

		"CONFIG" : [ ]
		, id : dat.id
	};
	dat.CONFIG.forEach(processRequest.bind(this));

	if(res.CONFIG.length > 0) {

		this.cloud.config(res);
	}

	/**
	 * Called for each config element in the request
	 */
	function processRequest(req) {

		if(req.type !== "MODULE") { // We only implement MODULE

			return;
		}

		if(!req.module) { // Module doesn't exist locally

			return this.log.debug("Bad module config request");
		}

		// If a module has a config method, always prefer that
		if(this.modules[req.module].config) { // Module has implemented a config method

			this.log.info("cloudConfig: Attempting request (%s)", req.module);
			this.modules[req.module].config(req.data);
			return;
		}

		if (req.data) { // No config method, data so PUT config
			// TODO write to disk

			var mod = getConfig.call(this, req.module);
			if(mod) {

				res.CONFIG.push(mod);
			}
		} else { // No config method, and no data so GET config

		}
	};

	/**
	 * Fetch a requested config
	 */
	function getConfig(mod) {

		//console.log(this.modules[mod]);
		if(this.modules[mod]) {

			if(this.modules[mod].opts) {

				return configResponse(mod, this.modules[mod].opts)
			}
		}
		return null;
	};

	/**
	 * Craft a config response object
	 */
	function configResponse(mod, conf) {

		return {

			type : "MODULE"
			, module : mod
			, data : conf
		}
	};

	function getAllConfigs(reqId) {

		// loop all this.modules, send configs in bundle.
		Object.keys(this.modules).forEach(function(mod) {

			res.CONFIG.push(configResponse(mod, this.modules[mod].opts))
		});
	};
};
