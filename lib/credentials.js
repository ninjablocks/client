var 
	fs = require('fs')
	, path = require('path')
	, loadableMethods = [

		'loadToken'
		, 'saveToken'
		, 'loadSerial'
		, 'saveSerial'
	]
;

/**
 * credential provider for user-defined
 * token & serial functions
 */

function credentials(opts) {

	this.token = undefined;
	this.serial = undefined;

	if((opts) && typeof opts === 'object') {

		loadableMethods.forEach(function(method) {

			if((opts[method]) && typeof opts[method] === 'function') {

				this[method] = opts[method].bind(this);
			}
		});
	}
};

credentials.prototype.getToken = function getToken() {

	return this.token || undefined;
};

credentials.prototype.getSerial = function getSerial() {

	return this.serial || undefined;
};

credentials.prototype.loadToken = function loadToken() {

	return this._load('token')
};

credentials.prototype.saveToken = function saveToken() {

	return this._save('token');
};

credentials.prototype.saveSerial = function saveSerial() {

	return this._save('serial');
};

credentials.prototype._save = function(cred) {

	if(!this.opt[cred]) {

		this.log.error('Unable to save %s to file (no path specified).', cred);
		return false;
	}
	if(!fs.existsSync(path.dirname(this._credFile(cred)))) {

		this.log.error('Unable to save %s to file (invalid path).', cred);
		return false;
	}
	this.log.debug('Attempting to save %s to file...', cred);
	try {

		fs.writeFileSync(this._credFile(cred), this[cred]);
	}
	catch (e) {

		this.log.error('Unable to save %s file (%s).', cred, e);
		return false;
	}
	this.log.info('Successfully saved %s to file.', cred);
	return true;
};

credentials.prototype._load = function _load(cred) {

	if(!this.opts[cred]) {

		this.log.error(

			'Unable to load %s from file (no path specified).'
			, cred
		);
		return false;
	}
	if(!fs.existsSync(path.dirname(this._credFile(cred)))) {

		this.log.error('Unable to load %s from file (invalid path).', cred);
		return false;
	}
	try {

		var cred = fs.readFileSync(this._credFile(cred), 'utf8');
	}
	catch (e) {

		this.log.error('Unable to load %s from file (%s).', cred, e);
		return false;
	}
	this[cred] = cred.replace(/\n/g, '');
	this.log.info('Successfully loaded %s from file.', cred);
	return true;
};

credentials.prototype._credFile = function _credFile(cred) {

	return this.opts[cred + 'File'] || undefined;
};

module.exports = credentials;
