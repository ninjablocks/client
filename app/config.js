/**
 * TODO: configuration profiles
 */

module.exports = function config(ninja, app) {

	if((ninja) && ninja.opts.device) {

		ninja.loadModule(

			'serial'
			, { device : ninja.opts.device, id : 'arduino' }
			, app
		);

		ninja.loadModule(

			'embedded'
			, { components : [ 'rgbled' ] }
			, app
		);

	}
	
	return ninja;
};
