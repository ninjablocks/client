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

		var 
			ninja = this
			, response = function(err, res, mod) {

				var 
					id = dat.id
					, module = mod
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
		;

		if(req.type !== "MODULE") { // We only implement MODULE

			return;
		}

		if(!req.module) { // probe the bloke~!


			console.log(req)
			if(!ninja.modules) { 

				return; 
			}
			Object.keys(ninja.modules).map(sendRequest);
			function sendRequest(mod) {

				if((ninja.modules[mod] && ninja.modules[mod].config)) {

					ninja.modules[mod].config(req.data || null, function(err, res) {
						
						response(err, res, mod);
					});
				}
			};
			return this.log.debug("cloudConfig: Cloud requesting block config");
		}

		// If a module has a config method, always prefer that
		if(this.modules[req.module].config) { 

			/**
			 * Called when a module response comes back
			 */

			
			this.log.info(

				"cloudConfig: Attempting request (%s:%s)"
				, req.module
				, dat.id
			);
			this.modules[req.module].config(req.data || null, function(err, dat) {

				response(err, dat, req.module); 
			});
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
