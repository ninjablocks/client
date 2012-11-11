var http = require('http'),
    exec = require('child_process').exec,
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    fs = require('fs'),
    path = require('path'),
    os = require('os'),
    sendIv;

var emitter = new EventEmitter;

var clientUtils = module.exports = {
    config:{},
    readings:{},
    instantContainer:{},
    motionContainer:{},
    watchDogIv:0,
    deviceMeta: {
        '0': {
            '2': {
                sensitivity:120
            },
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
        var self = this;
        this.config=config||{};
        this.tty=tty||{};

        fs.readdir(__dirname+'/../modules',function(err, files) {
            if (err) return;
            for (var i=0;i<files.length;i++) {
                if (files[i].indexOf('.js')==files[i].length-3) {
                    // File ends in .js, do it
                    try {
                        console.log(__dirname+'/../modules/'+files[i])
                        require(__dirname+'/../modules/'+files[i]).call(self);
                    } catch (err) {}
                }
            }
        });
    },
    initRemote: function(remote) {
        var self = this;
        this.remote = remote;
        this.tty.removeAllListeners('data');
        this.tty.on('data',function(data){
            self.handleRawTtyData(data);
        });
        clearInterval(sendIv);
        sendIv = setInterval(function(){
            self.remote.heartbeat(self.getHeartbeat());
        },this.config.heartbeat_interval); 

        // Reset arduino
        /*
        exec('/opt/utilities/bin/reset_arduino',function(code,stdout,stderr) {
            setTimeout(function() {
                self.changeLEDColor('green');
            },2000);
        });
         */
    },
    fetchBlockParams: function() {
        var params = {
            client:this.config.client,
            id:this.config.id,
            version:{
                node:this.config.nodeVersion,
                utilities:this.config.utilitiesVersion,
                system:this.config.systemVersion
            }
        };
        if (this.config.arduinoModel&&this.config.arduinoVersion) {
            params.version.arduino = {
                model:this.config.arduinoModel,
                version:this.config.arduinoVersion
            }
        };
        return params;
    },
    handleRawTtyData: function(data) {
        var jsonTtyData = this.getJSON(data) || false;
        if (!jsonTtyData || Object.keys(jsonTtyData).length!==1) return;
        switch (Object.keys(jsonTtyData)[0]) {
            case 'ACK':
                this.acknowledge(jsonTtyData.ACK)
            break;
            case 'DEVICE':
                this.handleDeviceData(jsonTtyData.DEVICE);
            break;
            case 'PLUGIN':
                console.log("Plugin")
                console.dir(jsonTtyData.PLUGIN)
            break;
            case 'UNPLUG':
                console.log("Unplug")
                console.dir(jsonTtyData.UNPLUG)
            break;
            case 'ERROR':
                // Ignore
            break;
        }
    },
    acknowledge: function(msg) {
        emitter.emit('DeviceAcknowledgement',msg);
    },
    handleDeviceData: function(deviceDataPoints) {
        if (!(deviceDataPoints instanceof Array)) return;
        for (var i=0; i<deviceDataPoints.length; i++) {
            var device = deviceDataPoints[i];
            if (device.D===2) device = this.convertAccelerometerToMotion(device);
            if (!device) continue;
            // Build the GUID
            device.GUID = this.buildDeviceGuid(this.config.id,device);
            var newMsg = {
                "NODE_ID":this.config.id,
                "TIMESTAMP": new Date().getTime(),
                "DEVICE":[device]
            }
            if (this.remote) {
                this.remote.data(JSON.stringify(newMsg));
                console.log(newMsg)
            } else {
                // TODO buffer commands
            }
        }
    },
    sendConfigData: function(deviceData) {
        var newMsg = {
            "NODE_ID":this.config.id,
            "TIMESTAMP": new Date().getTime(),
            "CONFIG":[deviceData]
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
                            return this.scanInterfaces();
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
    scanInterfaces: function() {
        var that = this;
        console.log(this.timestamp()+' Scanning Interfaces');
        var networkInterfaces = os.networkInterfaces();
        var DA = {
            ethernet: networkInterfaces['eth0']
        }
        if (networkInterfaces['wlan0']) DA.wifi=networkInterfaces['wlan0']
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
                        },5000);
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
        var self = this;
        switch (color) {
            case 'white':
                var hex = 'FFFFFF';
            break;
            case 'yellow':
                var hex = 'FFFF00';
            break;
            case 'red':
                var hex = 'FF0000';
            break;
            case 'purple':
                var hex = 'FF00FF';
            break;
            case 'green':
                var hex = '00FF00';
            break;
            case 'cyan':
                var hex = '00FFFF';
            break;
            default:
                var hex = '000000';
            break;
        };
        // Trying this ACK thing here first
        var retryCount = 0;

        var retryIv = setInterval(function() {
            self.writeTTY(self.tty,toSend);
            if (retryCount>2) {
                emitter.removeListener('DeviceAcknowledgement',retryListener);
                clearInterval(retryIv);
            }
            else retryCount++;
        },500);

        var retryListener = function(msg) {
            if (util.isArray(msg) && msg[0].D===999 && msg[0].DA===hex) {
                emitter.removeListener('DeviceAcknowledgement',retryListener);
                clearInterval(retryIv);
            }
        };

        emitter.on('DeviceAcknowledgement',retryListener);
        var toSend = this.wrapCommand(hex,999,0,'0');
        this.writeTTY(this.tty,toSend);
    },
    convertAccelerometerToMotion: function(device) {
        if (!this.motionContainer.DA) {
            this.motionContainer = device;
            return;
        }
        // Split up data in the container which is in the form x,y,x
        var sumParts1 = this.motionContainer.DA.split(',');
        if (sumParts1.length!==3) {
            this.motionContainer={};
            return;
        }
        // Sum all the values of the coordinates
        var sum1 = parseInt(sumParts1[0])+parseInt(sumParts1[1])+parseInt(sumParts1[2]);
        var sumParts2 = device.DA.split(',');
        if (sumParts2.length!==3) {
            delete device;
            return;
        }
        // Split up data from the device which is in the form x,y,x
        var sum2 = parseInt(sumParts2[0])+parseInt(sumParts2[1])+parseInt(sumParts2[2]);
        // Set the container to the latest device value
        this.motionContainer = device;
        // Calculate the difference between the previous coordinate summate and the latest
        var diff = sum2-sum1;
        var meta = this.getDeviceMetaData(device);
        // If absolute value of the difference is greater than the sensitivity, fire off the motion device
        if (diff>meta.sensitivity || diff<-meta.sensitivity) {
            var out = {
                G:"0",
                V:0,
                D:3,
                DA:1
            };
            out.GUID = this.buildDeviceGuid(this.config.id,out);
            return out;
        }
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
};