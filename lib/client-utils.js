var http = require('http');

var clientUtils = {
    config:{},
    configure:function(c) {
        this.config=c;
    },
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
    getJSON : function(chunk){
        try {
            return JSON.parse(chunk);
        } catch (e) {
            console.log('Ignored: '+e);
            return false;
        }
    },
    writeTTY : function(tty,data,errorCallback){
        try {
            tty.write(data);
            return true;
        } catch (e) {
            console.log('writeTTY error: '+e);
            if (errorCallback) errorCallback(e);
            return false;
        }
    },
    wrapCommand : function(DA,D,V,G){
        // V defaults to Ninja Blocks, G is not used, but must be present
        var msg = {};
        msg.DA = DA;
        msg.D = D;
        msg.V = V || 0;
        msg.G = G || "";
        var commandOb = {"DEVICE": [msg]};
        return JSON.stringify(commandOb)
    },
    isEmpty : function(obj) {
        return Object.keys(obj).length === 0;
    },
    changeLEDColor: function(tty,color) {
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
        this.writeTTY(tty,'{"DEVICE":[{"G":"0","V":0,"D":1000,"DA":"'+hex+'"}]}');
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
        console.log("Taking a picture");
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
                    console.log('Server ended');
                });
            });
            postReq.on('error',function(err) {
                console.log('Error sending picture: ');
                console.log(err);
            });
            getRes.on('data',function(data) {
                postReq.write(data,'binary');
            });
            getRes.on('end',function() {
                postReq.end();
                console.log("Image sent");
            });
        });
        getReq.on('error',function(error) {
            console.log(error);
        });
        getReq.end();
    },
    sendCameraStream: function(guid,token) {
        console.log("Sending Stream");
        var getOptions = {
            host:'localhost',
            port:5000,
            path:'/?action=stream',
            method:'GET'
        };

        var postOptions = {
            host:this.config.cloudStream,
            port:this.config.cloudStreamPort,
            path:'/rest/v0/camera/'+guid+'/stream',
            method:'POST',
        };
        proto = (this.config.cloudStreamPort==443) ? require('https') : require('http')
        var getReq = http.get(getOptions,function(getRes) {
            postOptions.headers = getRes.headers;
            postOptions.headers['X-Ninja-Token'] = token;
            var postReq = https.request(postOptions,function(postRes) {
                postRes.on('end',function() {
                    console.log('Stream Ended by Server');
                });
            });
            postReq.on('error',function(err) {
                console.log('Error sending stream: ');
                console.log(err);
            });
            getRes.on('data',function(data) {
                postReq.write(data,'binary');
            });
            getRes.on('end',function() {
                postReq.end();
                console.log('Sent '+picLen+' bytes');
            });
        });
        getReq.on('error',function(error) {
            console.log('GET error:');
            console.log('Could not find webcam service');
        });
        getReq.end();
    },
}
module.exports = clientUtils;
