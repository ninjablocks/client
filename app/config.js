/**
 * TODO: configuration profiles
 */

module.exports = function config(ninja, app) {

	if((ninja) && ninja.opts.device) {

		ninja.loadModule('serial', { device : ninja.opts.device, id : 'arduino' }, app);

	}
	
	return ninja;
};
