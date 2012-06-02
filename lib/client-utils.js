var clientUtils = {
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
    rgb : function(tty,color) {
       clientUtils.writeTTY(tty,clientUtils.wrapCommand(color,1000));
    }
}
module.exports = clientUtils;