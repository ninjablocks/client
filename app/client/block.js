
function block(remote, conn) {

	var 
		token = this.credentials.token || undefined
		, params = {

			//TODO: better client default/detection?
			client : this.opts.client || 'beagle'
			, id : this.credentials.id
			, version : {

				// node, arduino, utilities & system versions
			}
		}
		, handshake = function handshake(err, res) {

			if(err) {

				this.log.error("Error in remote handshake: %s", err);
				return;
			}

			conn.emit('up', res);
			this.emit('client::authed', res);

		}.bind(this)
		, activate = function activate(err, auth) {

			this.log.debug("Activation request received by cloud.");
			if(err || !auth) {

				err = err || 'No credentials received.';
				this.log.error("Error activating (%s). Exiting.", err);

				process.exit(1);
			}
			this.log.info('Received authorization, confirming...');
			remote.confirmActivation(params, confirm);

		}.bind(this)
		, confirm = function confirm(err) {

			if(err) {

				this.log.error("Error pairing block (%s).", err.error);
				if(err.id === 409) { 

					this.emit('client::conflict');
				}
				this.emit('client::error', err);
				this.emit('client::invalidToken', true);
			}
			else {

				this.log.info("Confirmed authorization. Exiting...");
			}
		}.bind(this)
	;

	if(token) {

		remote.handshake(params, token, handshake);
	}
	else {

		this.emit('client::activation', true);
		this.log.info("Attempting to activate...");

		remote.activate(params, activate)
	}
};

module.exports = block;