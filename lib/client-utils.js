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
            if (callback) errorCallback(e);
            return false;
        }
    },
    emptyDeviceMsg : function() {
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

/*
        tty.on("data", function (data) {
        // console.log(isJSON(data)+" "+flags.firehoseUP);
        if (isJSON(data) && flags.firehoseUP) {
            if (heartbeatRequest.connection.writable) {
                var payload = wrapMsg(JSON.parse(data))
                // console.log(payload)
                if (counters.beats>100) {
                    console.log('beats sent: '+counters.beatsTotal+' beatsDropped: '+counters.beatsDropped);
                    counters.beats = 0;
                }
                counters.beats++;
                counters.beatsTotal++;
                // console.log(payload);
                heartbeatRequest.write(payload);
            } else {
                if (counters.dropped>100) {
                    console.log('beats sent: '+counters.beatsTotal+' beatsDropped: '+counters.beatsDropped)
                    counters.dropped = 0;
                }
                counters.dropped++;
                counters.beatsDropped++;
            }
        }
    });
*/