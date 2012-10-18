var wifi = module.exports = function() {
    var wifiGuid = this.buildDeviceGuid(this.config.id,{G:"0",V:0,D:1005});
    console.log(wifiGuid)
    this.readings[wifiGuid] = {
        GUID:wifiGuid,
        G:"0",
        V:0,
        D:1005,
        DA:"1"
    };
};