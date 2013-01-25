exports.buildDeviceMap = function(devices) {
  var out = {};
  for (var i in devices) {
    out[i] = {
      G:devices[i].G,
      V:devices[i].V,
      D:devices[i].D
    }
  }
  return out;
}