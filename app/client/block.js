/**
 * Ninja Block client.prototype.block
 * This is where we maintain client presence
 * and manage dojo relations
 */

function block(remote, conn) {

	var
		token = this.token || undefined
		, params = {

			// assume we're on a random system (e.g. not official ninja block)
			client : this.opts.client || 'ninja-client'
			, id : this.serial || undefined
			, version : this.version || {

				node : undefined
				, utilities : undefined
				, system : undefined
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
				return;
			}
			this.log.info("Confirmed authorization");
			this.app.emit('client::authed', true);
			if(this.opts.env !== "production") {

				this.log.info("Please restart this process to connect!");
			}
			process.nextTick(process.exit);
	
		}.bind(this)
	;

	if(!this.version) {

		this.log.warn("This client does not have proper version information");
	}
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
