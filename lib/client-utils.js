var http = require('http'),
    exec = require('child_process').exec,
    fs = require('fs'),
    os=require('os'),
    child;

var clientUtils = {
    config:{},
    socket:{},
    readings:{},
    instantContainer:{},
    watchDogIv:0,
    deviceMeta: {
        '0': {
            '1000': {
                instant:true
            },
            '5': {
                instant:true
            },
            '7': {
                instant:true
            },
            '11': {
                instant:true
            }
        }
    },
    configure: function(config,socket,tty) {
        this.config=config;
        this.socket=socket;
        this.tty=tty;
    },
    handleRawTtyData: function(data) {
        var jsonTtyData = this.getJSON(data) || false;
        if (!jsonTtyData) return;
        var deviceDataPoints = jsonTtyData.DEVICE;
        if (!(deviceDataPoints instanceof Array)) return;
        // only keep latest reading per device between heartbeats
        for (var i=0; i<deviceDataPoints.length; i++) {
            var device = deviceDataPoints[i];
            // Build the GUID
            device.GUID = this.buildDeviceGuid(this.config.id,device);
            // If we have meta data about the device, handle it.
            if (this.deviceHasMetaData(device)) {
                var meta = this.getDeviceMetaData(device);
                if (meta.instant) this.trySendInstantData(device);
            }
            // Add the devices data to the heartbeat container
            this.readings[deviceDataPoints[i].GUID] = deviceDataPoints[i];
        }
    },
    trySendInstantData: function(deviceData) {
        if (this.instantContainer.hasOwnProperty(deviceData.GUID)) {
            // We've got stuff
            if (this.instantContainer[deviceData.GUID].DA!==deviceData.DA) {
                // It's different
                var newMsg = {
                    "NODE_ID":this.config.id,
                    "TIMESTAMP": new Date().getTime(),
                    "DEVICE":[deviceData]
                }
                this.socket.emit('data',JSON.stringify(newMsg));
            }
        }
        this.instantContainer[deviceData.GUID] = deviceData;
    },
    sendConfigData: function(deviceData) {
        var newMsg = {
            "NODE_ID":this.config.id,
            "TIMESTAMP": new Date().getTime(),
            "DEVICE":[deviceData]
        }
        this.socket.emit('config',JSON.stringify(newMsg));
    },
    getHeartbeat: function(){
        var hb = {  
            "NODE_ID":this.config.id,
            "TIMESTAMP": null,
            "DEVICE":[] 
        };
        hb.TIMESTAMP = new Date().getTime();
        for (r in this.readings) {
            if (this.readings.hasOwnProperty(r)) {
                hb.DEVICE.unshift(this.readings[r]);
            }
        }
        this.readings={};
        return JSON.stringify(hb);
    },
    beatThrottle: {
        isGoodToGo : function() {
            return (!this.isEmpty(this.readings));
        }
    },
    executeCommand: function(data){
        var that = this;
        var data = this.getJSON(data);
        var ds = data.DEVICE;
        if (ds && ds.length>0) {
            for (d in ds) {
                var guid = ds[d].GUID;
                delete ds[d].GUID;
                ds[d].G = ds[d].G.toString(); //TODO get JP to fix for 0
                switch(ds[d].D) {
                    case 1004: 
                        // Take picture
                        this.takePicture(guid,this.config.token);
                        break;
                    case 1005:
                        if (typeof ds[d].DA=="string" && ds[d].DA==="SCAN") {
                            this.scanWifi();
                        } else if (typeof ds[d].DA==="object") {
                            //this.configWifi(ds[d].DA);
                        }
                        break;
                    default:
                        return this.writeTTY(this.tty,'{"DEVICE":['+JSON.stringify(ds[d])+']}');
                        break;
                }
            }
        }
    },
    configWifi: function(config) {
        return false;
    },
    scanWifi: function() {
        var that = this;
        console.log(this.timestamp()+' Scanning Wifi');
        exec('sudo /sbin/ifconfig wlan0 up',function(error, stdout, stderr) {
            exec('/opt/utilities/wifi/wiscan.pl',function (scanError, scanStdout, scanStderr) {
                if (scanError||scanStderr) {
                    //deal with this issue
                    console.log(that.timestamp()+' Scanning Wifi Error: Unknown');
                } else {
                    var wifiList = scanStdout.split('\n');
                    var configPacket=[];
                    for (var i=0;i<wifiList.length;i++) {
                        if (!wifiList[i]||wifiList[i].length==0) continue;
                        try {
                            var wifiSplit = wifiList[i].split(',');
                            var thisPacket = {
                                ssid:wifiSplit[1],
                                quality:wifiSplit[2],
                                sigLevel:wifiSplit[3],
                                encryption:wifiSplit[4],
                                encType:wifiSplit[5],
                                authType:wifiSplit[6]
                            };
                            configPacket.push(thisPacket);
                        } catch (err) {
                            console.log(that.timestamp()+' Scanning Wifi Error: '+err);
                        }
                    };
                    var networkInterfaces = os.networkInterfaces();
                    var DA = {
                        //wifi:configPacket,
                        ethernet: networkInterfaces['eth0']
                    }
                    var deviceData = {
                        G:"0",
                        V:0,
                        D:1005,
                        DA:DA
                    }
                    var guid = that.buildDeviceGuid(that.config.id,deviceData);
                    deviceData.GUID=guid;
                    that.sendConfigData(deviceData);
                }
            });
        });
    },
    updateCode: function(a) {
        var that = this;
        this.changeLEDColor('white');
        for (var i=0;i<a.length;i++) {
            // Remove this flag
            try {
                fs.unlinkSync(this.config.updateLock+'_'+a[i]);
            } catch (err) {}
            switch(a[i]) {
                case 'node':
                    child = execFile('/opt/utilities/bin/ninja_update_node',function (error, stdout, stderr) {
                        // Make sure that we reboot after we're done updating node code
                        // If there are other updates to do
                        console.log(that.timestamp()+' Restarting');
                        if (a.length>1) {
                            clearInterval(that.watchDogIv);
                        } else {
                            that.socket.disconnect();
                            process.exit(1);
                        }
                        that.changeLEDColor('yellow');
                    });
                    break;
                case 'arduino':
                case 'utilities':
                case 'system':
                    // If node is not updating
                    // Stop writing to the watchdog to force a reboot
                    if (a.indexOf('node')===-1) clearInterval(this.watchDogIv);
                    break;
            }
        }
    },
    timestamp: function() {
        return new Date().toUTCString();
    },
    getJSON: function(chunk){
        try {
            return JSON.parse(chunk);
        } catch (e) {
            console.log(this.timestamp()+' Ignored: '+e);
            return false;
        }
    },
    writeTTY: function(tty,data,errorCallback){
        try {
            tty.write(data);
            return true;
        } catch (e) {
            console.log(this.timestamp()+' writeTTY error: '+e);
            if (errorCallback) errorCallback(e);
            return false;
        }
    },
    wrapCommand: function(DA,D,V,G){
        // V defaults to Ninja Blocks, G is not used, but must be present
        var msg = {
            "DEVICE":[{
                G:G||"",
                V:V||0,
                D:D,
                DA:DA
            }]
        }
        return JSON.stringify(msg);
    },
    isEmpty : function(obj) {
        return Object.keys(obj).length === 0;
    },
    changeLEDColor: function(color) {
        switch (color) {
            case 'purple':
                var hex = 'FF00FF';
            break;
            case 'green':
                var hex = '00FF00';
            break;
            case 'red':
                var hex = 'FF0000';
            break;
            case 'cyan':
                var hex = '00FFFF';
            break;
            case 'yellow':
                var hex = 'FFFF00';
            break;
            case 'white':
                var hex = 'FFFFFF';
            break;
            default:
                var hex = '000000';
            break;
        }
        this.writeTTY(this.tty,'{"DEVICE":[{"G":"0","V":0,"D":1000,"DA":"'+hex+'"}]}');
    },
    buildDeviceGuid: function(nodeid,device) {
        return nodeid+'_'+device.G+'_'+device.V+'_'+device.D;
    },
    deviceHasMetaData: function(device) {
        return (clientUtils.deviceMeta[device.V]&&clientUtils.deviceMeta[device.V][device.D]);
    },
    getDeviceMetaData: function(device) {
        return clientUtils.deviceMeta[device.V][device.D];
    },
    takePicture: function(guid,token) {
        var that = this;
        console.log(this.timestamp()+" Taking a picture");
        var getOptions = {
            host:'localhost',
            port:5000,
            path:'/?action=snapshot',
            method:'GET'
        };
        var postOptions = {
            host:this.config.cloudStream,
            port:this.config.cloudStreamPort,
            path:'/rest/v0/camera/'+guid+'/snapshot',
            method:'POST',
        };
        proto = (this.config.cloudStreamPort==443) ? require('https') : require('http')
        var getReq = http.get(getOptions,function(getRes) {
            postOptions.headers = getRes.headers;   
            postOptions.headers['X-Ninja-Token'] = token;
            var postReq = proto.request(postOptions,function(postRes) {
                postRes.on('end',function() {
                    console.log(that.timestamp()+' Stream Server ended');
                });
            });
            postReq.on('error',function(err) {
                console.log(that.timestamp()+' Error sending picture: ');
                console.log(err);
            });
            getRes.on('data',function(data) {
                postReq.write(data,'binary');
            });
            getRes.on('end',function() {
                postReq.end();
                console.log(that.timestamp()+" Image sent");
            });
        });
        getReq.on('error',function(error) {
            console.log(that.timestamp()+" "+error);
        });
        getReq.end();
    },
    setWatchDogIv: function(iv) {
        this.watchDogIv = iv;
    }
}
module.exports = clientUtils;
