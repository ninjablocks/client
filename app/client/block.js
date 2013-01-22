/**
 * Ninja Block client.prototype.block
 * This is where we maintain client presence
 * and manage dojo relations
 */

function block(remote, conn) {

	var 
		token = this.token || undefined
		, params = {

			//TODO: better client default/detection?
			client : this.opts.client || 'beagle'
			, id : this.serial || undefined
			, version : {

				node : process.version
				, utilities : "v3"
				, system : "v1"
				, arduino : "v42"
			}
		}
		, handshake = function handshake(err, res) {

			if(err) {

				this.log.error("Error in remote handshake: %s", err);
				return;
			}

			this.log.debug("Successfully completed handshake");
			conn.emit('up', res); // emit handlers to upnode

		}.bind(this)
		, activate = function activate(err, auth) {

			if(err || !auth) {

				err = err || 'No credentials received';
				this.log.error("Error activating (%s)", err);
				this.app.emit('client::error', err);
			}

			params.token = auth.token || '';
			this.token = auth.token || undefined;
			this.saveToken();

			this.log.info('Received authorization, confirming...');
			remote.confirmActivation(params, confirm);

		}.bind(this)
		, confirm = function confirm(err) {

			if(err) {

				this.log.error("Error pairing block (%s)", err.error);
				this.app.emit('client::error', err);
			}
			else {

				this.log.info("Confirmed authorization");
				this.app.emit('client::authed', true);
			}
		}.bind(this)
	;

	if((token) && token.length) {

		remote.handshake(params, token, handshake);
	}
	else {

		this.app.emit('client::activation', true);
		this.log.info("Attempting to activate...");

		remote.activate(params, activate);
	}
};

module.exports = block;
