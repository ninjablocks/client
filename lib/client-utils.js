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
    devices:{},
    config:{},
    readings:{},
    connectBuffer:[],
    debounceContainer:{},
    throttleContainer:{},
    motionContainer:{},
    queueContainer:[],
    deviceMeta: {
        '0': {
            '2': {
                transformAccelerometer:true,
                sensitivity:120
            },
            '6': {
                throttle:true,
                throttleSensitivity:5,
                throttleTimeout:30000
            },
            '10': {
                transformSamsungDistance:true,
                throttle:true,
                throttleSensitivity:1,
                throttleTimeout:30000
            },
            '11': {
                debounce:true,
                debounceTimeout:300,
                queueCommands:true
            },
            '999': {
                queueCommands:true
            },
            '1000': {
                queueCommands:true
            },
            '1002': {
                queueCommands:true
            },
            '1007': {
                queueCommands:true
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
                try {
                    // Query the entry
                    stats = fs.lstatSync(__dirname+'/../modules/'+files[i]);
                    // Is it a directory?
                    if (stats.isDirectory()) {
                        // Yes it is
                        console.log(self.timestamp()+ ' Loading Module '+files[i]);
                        require(__dirname+'/../modules/'+files[i]+'/index.js').call(self);
                    }
                } catch (err) {
                    console.log(self.timestamp()+' '+err);
                    console.log(err.stack);
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

        if (this.connectBuffer.length>0) {
            this.remote.data({
                'DEVICE':this.connectBuffer
            });
            this.connectBuffer=[];
        }


        // Reset arduino
        /*
        exec('/opt/utilities/bin/reset_arduino',function(code,stdout,stderr) {
            setTimeout(function() {
                self.changeLEDColor('green');
            },2000);
        });
         */
    },
    registerDevice: function(device) {
        if (!device) return;
        var self = this;

        device.guid = this.buildDeviceGuid(this.config.id,device);

        device.on('data',function(data) {

            try {
                self.sendData({
                    G:device.G,
                    V:device.V,
                    D:device.D,
                    DA:data
                } );
            } catch (err) {}
        });

        device.on('config',function(config) {
            self.sendConfigData(config);
        });
        this.devices[device.guid] = device;
    },
    deregisterDevice: function(device) {
        this.devices[device.guid].removeAllListeners();
        delete this.devices[device.guid];
    },
    sendData: function(msg) {

        if (!msg) return;
        // If we're connected, send
        // Otherwise buffer until we're connected
        // But only the last 10 commands
        msg.GUID = this.buildDeviceGuid(this.config.id,msg);
        msg.TIMESTAMP = (new Date().getTime());


        if (this.remote && this.remote.data) {
            this.remote.data({
                'DEVICE':[msg]
            });
        } else {
            var buf = this.connectBuffer;
            buf.push(msg);
            if (buf.length>9) {
                buf.shift();
            }
            this.connectBuffer = buf;
        }
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
                this.plugin(jsonTtyData.PLUGIN);
            break;
            case 'UNPLUG':
                this.unplug(jsonTtyData.UNPLUG);
            break;
            case 'ERROR':
                // Ignore
            break;
        }
    },
    plugin:function(msg) {

        var config = msg[0];
        config.type="PLUGIN";
        this.sendConfigData(config);
    },
    unplug: function(msg) {

        var config = msg[0];
        config.type="UNPLUG";
        this.sendConfigData(config);
    },
    acknowledge: function(msg) {

        this.sendData(msg[0]);
        emitter.emit('DeviceAcknowledgement',msg);
    },
    handleDeviceData: function(deviceDataPoints) {

        if (!(deviceDataPoints instanceof Array)) return;
        // Iterate over the data points
        for (var i=0; i<deviceDataPoints.length; i++) {

            var device = deviceDataPoints[i];

            if (this.deviceMeta.hasOwnProperty(device.V)) {
                var meta = this.deviceMeta[device.V][device.D];
            }

            if (meta) {
                // There is meta data about this device
                if (meta.transformAccelerometer) {
                    device = this.convertAccelerometerToMotion(device);
                } else if (meta.transformSamsungDistance) {
                    device = this.transformSamsungDistance(device);
                }

                if (meta.debounce) {
                    device = this.debounceDevice(device);
                } else if (meta.throttle) {
                    device = this.throttleDevice(device);
                }
            }

            if (device) {
                this.sendData(device);
            }

        }
    },
    throttleDevice: function(device) {
        var guid = this.buildDeviceGuid(this.config.id,device);

        if (this.throttleContainer.hasOwnProperty(guid)) {
            // We have a record for this device
            // If the DA is out of the sensitivity
            var lastSentDeviceData = this.throttleContainer[guid];
            var deviceMetaData = this.deviceMeta[device.V][device.D];
            var now = (new Date()).getTime();

            var highBound = lastSentDeviceData.DA + deviceMetaData.throttleSensitivity;
            var lowBound = lastSentDeviceData.DA - deviceMetaData.throttleSensitivity;

            // If they are within +/- sensitivity and within timeout
            if (device.DA > lowBound
                && device.DA < highBound
                && lastSentDeviceData.TIMESTAMP+deviceMetaData.throttleTimeout > now) return;

        }
        this.throttleContainer[guid] = device;
        this.throttleContainer[guid].TIMESTAMP = (new Date()).getTime();
        return device;
    },
    debounceDevice: function(device) {

        var guid = this.buildDeviceGuid(this.config.id,device);
        var doSendData = true;
        if (this.debounceContainer.hasOwnProperty(guid)) {
            // We have a record for this device
            var lastSentDeviceData = this.debounceContainer[guid];
            var deviceMetaData = this.deviceMeta[device.V][device.D];
            var now = (new Date()).getTime();
            // If we're still in the timeout period, do nothing
            if (lastSentDeviceData.TIMESTAMP+deviceMetaData.debounceTimeout >= now)
                doSendData = false;
            // If not send the data
        }
        device.TIMESTAMP = (new Date()).getTime();
        this.debounceContainer[guid] = device;

        if (doSendData)
            return device;
        else
            return;
    },
    sendConfigData: function(configMsg) {
        configMsg.GUID = this.buildDeviceGuid(this.config.id,configMsg);
        configMsg.TIMESTAMP = (new Date().getTime());
        if (this.remote && this.remote.config) {
            this.remote.config(JSON.stringify(configMsg));
        }
    },
    getHeartbeat: function(){
        var hb = {
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
        for (var d=0,ds=data.DEVICE;d<ds.length;d++) {

            var guid = ds[d].GUID;
            delete ds[d].GUID;
            ds[d].G = ds[d].G.toString(); //TODO get JP to fix for 0

            // If there is a handler with a .write() method, use it
            // Otherwise send to the arduino
            if (this.devices[guid] && typeof this.devices[guid].write === "function") {
                try {
                    return this.devices[guid].write(ds[d].DA);
                } catch (err) {
                    console.log(this.timestamp()+" Error Actuating "+guid+" ("+err.message+")");
                }
            } else if (this.deviceMeta.hasOwnProperty(ds[d].V)) {
                var meta = this.deviceMeta[ds[d].V][ds[d].D];
            }

            if (meta) {
                if (meta.queueCommands) {
                    return this.queueTTY(ds[d]);
                }

            } else {
                console.log(this.timestamp()+" Actuating "+guid+" ("+ds[d].DA+")");
                return this.writeTTY(this.tty,'{"DEVICE":['+JSON.stringify(ds[d])+']}');
            }
        }
        return true;
    },
    queueTTY: function(device) {
        var self = this;
        var timeOut;

        // Create our queue listener
        var queueListener = function(deviceAck) {

            clearTimeout(timeOut);
            // If there is the last listener, return;
            if (self.queueContainer.length===0) {
                return;
            }

            // Remove this device data from the queue
            self.queueContainer.splice(0,1);

            // If there is another value to write, do it.
            if (self.queueContainer.length>0) {
                doWrite(self.queueContainer[0]);
            }
        };

        var doWrite = function(queuedDevice) {

            var guid = self.buildDeviceGuid(self.config.id,queuedDevice);
            console.log(self.timestamp()+" Actuating "+guid+" ("+queuedDevice.DA+")");

            // Set the timeout for this command
            timeOut = setTimeout(function() {

                console.log(self.timestamp()+" "+guid+" Timed Out ("+queuedDevice.DA+")");
                queueListener([queuedDevice]);
            },1000);

            emitter.once('DeviceAcknowledgement',queueListener);
            self.writeTTY(self.tty,JSON.stringify({DEVICE:[queuedDevice]}));
        };

        // Add this device to the queue
        this.queueContainer.push(device);

        // If this was the only datapoint, send it to the serial port
        if (this.queueContainer.length===1) {
            doWrite(device);
        }

        return true;
    },
    updateCode: function(a) {

        var that = this;
        this.changeLEDColor('white');

        var watchdogLock = this.config.locksDir+'/.has_updated_watchdog';
        // Hack for old watdog
        // only happens once
        try {
            var stats = fs.lstatSync(watchdogLock);
        } catch (err) {
            console.log(that.timestamp()+' Setting Watchdog Lock');
            fs.writeFileSync(watchdogLock, '');
            // Force a sync to disk to ensure the updated node code
            // Makes its way to disk
            this._spawnWatchdogDaemon();
            exec('sync');
        }

        for (var i=0;i<a.length;i++) {
            // Nuke the lock file that deals with the element we're updating
            try {
                fs.unlinkSync(this.config.updateLock+'_'+a[i]);
            } catch (err) {
                console.log(that.timestamp()+' '+err);
            }

            if (a[i]==='node') {

                // Pass our existing environment into the update script
                var options = {
                    env:process.env
                };
                console.log(that.timestamp()+' Beginning Client Update');
                exec('/opt/utilities/bin/ninja_update_node',options,function (error, stdout, stderr) {
                    console.log(that.timestamp()+' Restarting Node');
                    process.exit(1);
                });

            } else {
                setTimeout(function() {
                    process.exit(1);
                },2000);
            }

        }

    },
    _spawnWatchdogDaemon: function() {
        var wd = function() {
            require('fs').open('/dev/watchdog','r+',function(err,fd) {
                var pl = new Buffer(1);
                pl.write('\n','utf8');
                setInterval(function() {
                    require('fs').write(fd,pl,0, pl.length, -1);
                },5000);
            });
        }
        var toWrite = "("+wd.toString()+")()";
        console.log(this.timestamp()+' Writing watchdog daemon');
        fs.writeFileSync('/tmp/wd_daemon',toWrite);
        console.log(this.timestamp()+' Setting watchdog daemon permissions');
        fs.chmodSync('/tmp/wd_daemon',0755);
        console.log(this.timestamp()+' Spawning watchdog daemon');
        require('child_process').fork('/tmp/wd_daemon',[],{setsid:true});
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
            if (retryCount>3) {
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
            return out;
        }
    },
    transformSamsungDistance: function(dataPoint) {
        var lookup = [2.3,1.3,0.92,0.74,0.61,0.51,0.45,0.4];
        var voltage = (dataPoint.DA/1024)*5;

        if (isNaN(dataPoint.DA)) {
            dataPoint.DA = 0;
            return dataPoint;
        }
        if (voltage>lookup[0]) {
            dataPoint.DA = 0;
            return dataPoint;
        }
        if (voltage<lookup[lookup.length-1]) {
            dataPoint.DA = 81;
            return dataPoint;
        }

        for (var i=0;i<lookup.length;i++) {
            if (voltage<lookup[i]) continue;
            else {
                var betweenA = lookup[i-1];
                var betweenB = lookup[i];
                var prop = (voltage-betweenB/(betweenB-betweenA))+(i*10);
                dataPoint.DA = Math.round(prop*100)/100;
                return dataPoint;
            }
        }
        return;
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
    fetchBlockToken: function() {
        return path.existsSync(this.config.tokenFile)
            && fs
                .readFileSync(this.config.tokenFile)
                .toString()
                .replace(/\n/g,'')
            || false;
    }
};