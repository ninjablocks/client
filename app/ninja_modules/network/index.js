var 
    util = require('util')
    , stream = require('stream')
    , os = require('os')
;

function network(opts, app) {

    var 
        self = this
        , initialize = function(cloud) {
            
            self.log.debug("Initializing network module")
            self.cloud = cloud;
            self.emit('register', self);
            process.nextTick(function bump() {

                self.emit('data', '{}');
            });
        }
    ;

    this.log = app.log;
    this.readable = true;
    this.writeable = true;

    this.V = 0;
    this.D = 1005;
    this.G = "0";

    app.on('client::up', initialize);
};

util.inherits(network, stream);

network.prototype.write = function(data) {

    var cloud = this.cloud;

    try {

        var da = JSON.parse(data);
    } 
    catch(err) {

        this.log.debug("network: Invalid command");
        return false;
    }

    switch (da.method) {

        case 'SCAN':

            this.log.debug('network: Scanning interfaces...');
            var networkInterfaces = os.networkInterfaces();
            var DA = {

                result : {

                    ethernet : networkInterfaces['eth0']
                    , wifi : networkInterfaces['wlan0']
                }
                , error : null
                , id : da.id
            };

            this.emit('data', JSON.stringify(DA));

        break;
    }

    return true;
};

network.prototype.end = function() {

};

network.prototype.close = function() {

};

module.exports = network;

