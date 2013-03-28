var
    util = require('util')
    , stream = require('stream')
    , os = require('os')
;

function network(opts, app) {

    this.config = function(rpc,cb) {

        cb(null,os.networkInterfaces());
    };
};

util.inherits(network, stream);

module.exports = network;