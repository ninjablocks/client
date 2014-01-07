'use strict';

function Subscriptions(){

}

module.exports = Subscriptions;

Subscriptions.prototype.subscribe = function() {

  var self = this;

  if (!this.token) {

    // TODO: need to add a subscription for the credentials handler.
    return;

  }

  this.router.subscribe('$block/' + this.serial + '/revoke', function revokeCredentials() {
    self.log.info('MQTT Invalid token; exiting in 3 seconds...');
    self.app.emit('client::invalidToken', true);
    setTimeout(function invalidTokenExit() {

      self.log.info("Exiting now.");
      process.exit(1);

    }, 3000);
  });

  this.router.subscribe('$block/' + this.serial + '/commands', function execute(topic, cmd) {

    self.log.info('MQTT readExecute', JSON.parse(cmd));
    self.command(cmd);

  });

  this.router.subscribe('$block/' + this.serial + '/update', function update(topic, cmd) {

    self.log.info('MQTT readUpdate', JSON.parse(cmd));

    self.updateHandler(cmd);

  });

  this.router.subscribe('$block/' + this.serial + '/config', function update(topic, cmd) {
    self.log.info('MQTT readConfig', cmd);
    self.moduleHandlers.config.call(self, JSON.parse(cmd));
  });

};