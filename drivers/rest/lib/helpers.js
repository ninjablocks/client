var request = require('request');

exports.fetchDeviceData = function(ninja,guid,cb) {

  var proto = (ninja.opts.secure) ? 'https://' : 'http://';
  var uri = proto+ninja.opts.apiHost+':'+ninja.opts.apiPort+'/rest/v0/device/'+guid;
  var opts = {
    url:uri,
    headers: {
      'X-Ninja-Token':ninja.token
    },
    method:'GET',
    json:true
  };

  request(opts,function(e,r,b) {
    if (b && b.result===1) {
      cb(null,b.data)
    } else {
      cb(b&&b.error||"REST: Unknown Error")
    }
  });
}

exports.allowCORS = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.header('Origin')||'*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Accept, Content-Type, Authorization, Content-Length, X-Requested-With, X-Ninja-Token');

  // intercept OPTIONS method
  if ('OPTIONS' === req.method) {
    res.send(200);
  } else {
    next();
  }
};