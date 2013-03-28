var
	fs = require('fs')
	, path = require('path')
	, loadableMethods = [

		'loadToken'
		, 'saveToken'
		, 'loadSerial'
		, 'saveSerial'
	]
	, crypto = require('crypto')
	, mkdirp = require('mkdirp')
	, existsSync = fs.existsSync || path.existsSync
;

/**
 * credential provider for user-defined
 * token & serial functions
 */

function credentials(opts) {

	this.token = undefined;
	this.serial = undefined;

	// Special case if the serial does not exist
	if (!existsSync(opts.serialFile)) {

		// If the serial file does not exist, create one
		var
			generatedSerial = crypto
				.randomBytes(8)
				.toString('hex')
				.toUpperCase()
			, dirName = path.dirname(opts.serialFile)
			, serialFile = path.basename(opts.serialFile)
		;

		try {

			mkdirp.sync(dirName);
			fs.writeFileSync(opts.serialFile, generatedSerial);
		}
		catch(e) {

			if(e.code == "EACCES") {

				this.log.error(

					"Filesystem permissions error (%s)"
					, opts.serialFile
				);
			}
			else {

				this.log.error(

					"Cannot create serial file (%s): %s"
					, opts.serialFile
					, e
				);
			}
			return process.exit(1);
		}
	}

	/**
	 * Create and bind the loadable methods to client:
	 */
	loadableMethods.forEach(function(method) {

		if((opts) && (opts[method]) && typeof opts[method] === 'function') {

			this.log.debug("Binding non-default %s method", method);
			this[method] = opts[method].bind(this);
		}
		else {

			this.log.debug("Binding default %s method", method);
			bindMethod.call(this, method)
		}
	}.bind(this));

	/**
	 * Respond to revokeCredential requests from dojo
	 * and other calls for token removal
	 */
	this.app.on('client::invalidToken', function() {

		this.log.debug("Attempting to invalidate token...");
		this.token = '';
		this.saveToken();
	}.bind(this));

	this.loadToken();
	this.loadSerial();

	this.log.info("This Ninja's Serial: %s", this.serial);
	return this;
};

function bindMethod(method) {

	var
		cred = method.substr(4).toLowerCase()
		, action = method.substr(0, 4)
	;

	this[method] = credManager.bind(this, action, cred);
};

function credManager(action, cred) {

	if(action == 'save') {

		saveCred.call(this, cred);
	}
	else if(action == 'load') {

		loadCred.call(this, cred);
	}
};

function saveCred(cred) {

	var cFile = credFile.call(this, cred);
	if(!cFile) {

		this.log.error('Unable to save %s to file (no path specified)', cred);
		return false;
	}
	this.log.debug('Attempting to save %s to file...', cred);
	try {

		fs.writeFileSync(cFile, this[cred]);
	}
	catch(e) {

		this.log.error('Unable to save %s file (%s)', cred, e);
		return false;
	}
	this.log.info('Successfully saved %s to file', cred);
	return true;
};

function loadCred(cred) {

	var contents = ''
		, cFile = credFile.call(this, cred);

	if(!cFile) {

		this.log.error('Unable to load %s from file (no path specified)', cred);
		return false;
	}
	try {

		if (existsSync(cFile)) {

			contents = fs.readFileSync(cFile, 'utf8');
		}
	}
	catch(e) {

		this.log.error('Unable to load %s from file (%s)', cred, e);
		return false;
	}
	this[cred] = contents.replace(/\n/g, '');
	this.log.info('Successfully loaded %s from file', cred);
	return true;
};

function credFile(cred) {

	return this.opts[cred + 'File'] || undefined;
};

module.exports = credentials;
