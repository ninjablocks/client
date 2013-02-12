module.exports = config;

/**
 * Remote config request (from cloud)
 */
function config(dat, cb) {

	if(!dat.CONFIG || !dat.id) { return; }

	dat.CONFIG.map(processRequest.bind(this));

	/**
	 * Called for each config element in the request
	 */
	function processRequest(req) {

		var ninja = this;

		if(req.type !== "MODULE") { // We only implement MODULE

			return;
		}

		if(!req.module) { // Module doesn't exist locally

			return this.log.debug("Bad module config request");
		}

		// If a module has a config method, always prefer that
		if(this.modules[req.module].config) { 

			/**
			 * Called when a module response comes back
			 */
			var response = function(err, res) {

				var 
					id = dat.id
					, module = req.module
				; 
				// error in module response
				if(err) {

					// what to do here? 
					return ninja.log.error(

						"cloudConfig: %s (%s:%s)"
						, err
						, module
						, id
					);
				}
				res.id = id;
				ninja.log.debug(

					"cloudConfig: Sending response (%s:%s)"
					, module
					, id
				);
				ninja.cloud.config({

					"CONFIG" : [{

						type : "MODULE"
						, module : module
						, data : res
					}]
					, id : id
				});
			};

			this.log.info(

				"cloudConfig: Attempting request (%s:%s)"
				, req.module
				, dat.id
			);
			this.modules[req.module].config(req.data || null, response);
			return;
		}
		// module has no .config method, send an error or somethign?
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
