/**
 * TODO: configuration profiles
 */

module.exports = function config(ninja, app) {


	if((!ninja) || !ninja.opts) {

		return false;
	}
	
	// default arduino device path	
	if(!ninja.opts.client || ninja.opts.client == 'beagle') {

		ninja.opts.device = '/dev/ttyO1';
	}
	
	/**
	 * Load ninja cape & arduino modules if present
	 */
	if(ninja.opts.device) {

		// arduino controller
		ninja.loadModule(

			'platform'
			, { id : 'arduino' }
			, app
		);

		// serial device
		ninja.loadModule(

			'serial'
			, { device : ninja.opts.device, id : 'arduino' }
			, app
		);

		ninja.loadModule(

			'network'
			, { }
			, app
		);
	}
	
	ninja.emit('loaded'); // done loading modules
	ninja.connect();

	return ninja;
};
