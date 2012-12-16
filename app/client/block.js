/**
 * Ninja Block client.prototype.block
 * This is where we maintain client presence
 * and manage dojo relations
 */

function block(remote, conn) {

	var 
		token = this.credentials.token || undefined
		, params = {

			//TODO: better client default/detection?
			client : this.opts.client || 'beagle'
			, id : this.credentials.id
			, version : {

				node : process.version
				, utilities : null
				, system : null
				// node, arduino, utilities & system versions
			}
		}
		, handshake = function handshake(err, res) {

			if(err) {

				this.log.error("Error in remote handshake: %s", err);
				return;
			}

			this.log.info("Successfully completed handshake.");
			conn.emit('up', res);
			this.emit('client::authed', res);

		}.bind(this)
		, activate = function activate(err, auth) {

			if(err || !auth) {

				err = err || 'No credentials received.';
				this.log.error("Error activating (%s).", err);
				this.emit('client::error', err);
			}

			params.token = auth.token || '';
			this.credentials.token = auth.token || undefined;
			this.log.info('Received authorization, confirming...');
			remote.confirmActivation(params, confirm);

		}.bind(this)
		, confirm = function confirm(err) {

			if(err) {

				this.log.error("Error pairing block (%s).", err.error);
				this.emit('client::error', err);
			}
			else {

				this.log.info("Confirmed authorization.");
				this.emit('client::authed', true);
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
