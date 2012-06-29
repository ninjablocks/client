var clientUtils = {
    deviceMeta: {
        '0': {
            '5': {
                instant:true
            },
            '7': {
                instant:true
            },
            '10': {
                instant:true
            }
        }
    },
    getJSON : function(chunk){
        try {
            return JSON.parse(chunk);
        } catch (e) {
            console.log('getJSON error: '+e)
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
    }
}
module.exports = clientUtils;