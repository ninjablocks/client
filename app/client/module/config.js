module.exports = config;

function config(dat, cb) {

	if(!dat.CONFIG || !dat.id) { return; }
	var res = {

		"CONFIG" : [
		]
		, id : dat.id
	};

	dat.CONFIG.forEach(processRequest);
	if(res.CONFIG.length > 0) {

		this.cloud.config(res);
	}

	function processRequest(req) {

		if(req.type == "MODULE") {

			if(!req.module) {

				return this.log.debug("Bad module config request");
			}	
			if(!req.data) { // GET config request

				var mod = getConfig(req.module);
				if(mod) {

					res.CONFIG.push(mod);
				}
			}
			if(this.modules[req.module].config) { // PUT config request

				this.modules[req.module].config(req.data);
			}
		}
	}

	function getConfig(mod) {

		if(this.modules[mod]) {

			if(this.modules[mod].opts) {

				return configResponse(mod, this.modules[mod].opts)
			}
		}
		return null;
	}

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
