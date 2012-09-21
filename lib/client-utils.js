var http = require('http'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path'),
    os = require('os');

var clientUtils = {
    config:{},
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
            },
            '1002': {
                instant:true
            }
        }
    },
    configure: function(config,tty) {
        this.config=config||{};
        this.tty=tty||{};
    },
    handleRawTtyData: function(data) {
        var jsonTtyData = this.getJSON(data) || false;
        if (!jsonTtyData) return;
        if (jsonTtyData.ACK) {
            this.acknowledge(jsonTtyData.ACK)
        } else {
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
        }
    },
    acknowledge: function(msg) {
        //console.log(msg);
    },
    trySendInstantData: function(deviceData) {
        if (!this.remote) return;
        if (this.instantContainer.hasOwnProperty(deviceData.GUID)) {
            // We've got stuff
            if (this.instantContainer[deviceData.GUID].DA!==deviceData.DA) {
                // It's different
                var newMsg = {
                    "NODE_ID":this.config.id,
                    "TIMESTAMP": new Date().getTime(),
                    "DEVICE":[deviceData]
                }
                this.remote.data(JSON.stringify(newMsg));
            }
        }
        this.instantContainer[deviceData.GUID] = deviceData;
    },
    sendData:function(deviceData) {
        var newMsg = {
            "NODE_ID":this.config.id,
            "TIMESTAMP": new Date().getTime(),
            "DEVICE":[deviceData]
        }
        this.remote.data(JSON.stringify(newMsg));
    },
    sendConfigData: function(deviceData) {
        var newMsg = {
            "NODE_ID":this.config.id,
            "TIMESTAMP": new Date().getTime(),
            "DEVICE":[deviceData]
        }
        this.remote.config(JSON.stringify(newMsg));
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
                        return this.takePicture(guid);
                        break;
                    case 1005:
                        if (typeof ds[d].DA=="string" && ds[d].DA==="SCAN") {
                            return this.scanWifi();
                        } else if (typeof ds[d].DA==="object") {
                            //this.configWifi(ds[d].DA);
                        }
                        break;
                    default:
                        console.log(this.timestamp()+" Actuating "+guid+" ("+ds[d].DA+")");
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
        var networkInterfaces = os.networkInterfaces();
        var DA = {
            ethernet: networkInterfaces['eth0']
        };
        
        if (networkInterfaces.hasOwnProperty('wlan0')) 
            DA.wifi = networkInterfaces['wlan0'];

        var deviceData = {
            G:"0",
            V:0,
            D:1005,
            DA:DA
        }
        
        var guid = that.buildDeviceGuid(that.config.id,deviceData);
        deviceData.GUID=guid;
        that.sendConfigData(deviceData);
        return true;
        /*
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
                }
            });
        });
         */
    },
    updateCode: function(a) {
        var that = this;
        this.changeLEDColor('white');
        for (var i=0;i<a.length;i++) {
            // Nuke the lcok file that deals with the element we're updating
            try {
                fs.unlinkSync(this.config.updateLock+'_'+a[i]);
            } catch (err) {}

            switch(a[i]) {
                case 'node':
                    // Pass our existing environment into the update script
                    var options = {
                        env:process.env
                    };
                    console.log(that.timestamp()+' Beginning Client Update');
                    exec('/opt/utilities/bin/ninja_update_node',options,function (error, stdout, stderr) {
                        // Make sure that we reboot after we're done updating node code
                        // If there are other updates to do
                        console.log(that.timestamp()+' Restarting');
                        that.changeLEDColor('yellow');
                        setTimeout(function() {
                            process.exit(1);
                        },2000);
                    });
                    break;
                case 'arduino':
                case 'utilities':
                case 'system':
                    // We force a reboot by clearing the watchdog timer.
                    // This is a pretty ugly hack so we don't have to give sudo access to this process
                    // We wait 45 seconds to ensure the writeback cache has been flushed to disk.
                    console.log(that.timestamp()+' Clearing WatchDog Timer');
                    setTimeout(function() {
                        clearInterval(that.watchDogIv);
                    },31000);
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
        var that = this;
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
        setTimeout(function() {
            that.writeTTY(that.tty,'{"DEVICE":[{"G":"0","V":0,"D":1000,"DA":"'+hex+'"}]}');
        },500);
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
    getBrainScan: function(cb) {
        /*
        
            {
            "eSense":
                {"attention":91,"meditation":41},
             "eegPower":
                {"delta":1105014,"theta":211310,
                "lowAlpha":7730,"highAlpha":68568,
                "lowBeta":12949,"highBeta":47455,
                "lowGamma":55770,"highGamma":28247},
             "poorSignalLevel":0
             }

         */
    },
    takePicture: function(guid) {
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
            postOptions.headers['X-Ninja-Token'] = that.fetchBlockToken();
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
        return true;
    },
    setWatchDogIv: function(iv) {
        this.watchDogIv = iv;
    },
    fetchBlockToken: function() {
        return path.existsSync(this.config.tokenFile) 
            && fs
                .readFileSync(this.config.tokenFile)
                .toString()
                .replace(/\n/g,'')
            || false;
    }
}
module.exports = clientUtils;