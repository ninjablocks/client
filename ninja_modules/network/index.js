var util = require('util')
    , Device = require('../device')
    , os = require('os')
;

// TODO: modularize functionality

module.exports = function(opts, app) {

    this.registerDevice(new Network(this));
};

util.inherits(Network, Device);

function Network(cloud) {

    this._cloud = cloud;
    this.readable = true;
    this.writeable = true;
    this.V = 0;
    this.D = 1005;
    this.G = "0";
    var self = this;
    process.nextTick(function() {

        self.emit('data','{}');
    });
};

Network.prototype.write = function(data) {

    // Implements JSON-RPC
    var cloud = this._cloud;

    try {

        var da = JSON.parse(data);
    }
    catch(err) {

        console.log(cloud.timestamp()+' Network: Invalid Command');
        return false;
    }

    switch (da.method) {

        case 'SCAN':

            console.log(cloud.timestamp()+' Scanning Interfaces');
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

Network.prototype.end = function() {};

Network.prototype.close = function() {};
