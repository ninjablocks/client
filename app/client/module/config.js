module.exports = config;

/**
 * Remote config request (from cloud)
 */
function config(dat, cb) {

	if(!dat.CONFIG || !dat.id) { return; }

	dat.CONFIG.map(processRequest.bind(this));

	var cloudBuffer = [ ];

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

			blockProbe(mod, res);
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

	function blockProbe(mod, res) {

		if(!ninja.modules) { return; }

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
};
