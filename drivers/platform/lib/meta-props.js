module.exports = {

    '0' : {

        '2' : {

            method : 'transformAccelerometer'
            , sensitivity : 120
        }
        , '6' : {

            throttle : true
            , throttleSensitivity : 5
            , throttleTimeout : 30000
        }
        , '10' : {
            // TODO: samsung distance sensor not implemented
            method : 'transformSamsungDistance'
            , throttle : true
            , throttleSensitivity : 1
            , throttleTimeout : 30000
        }
        , '11' : {
	    savePersistantDevice : true
            , postDebounceMethod : 'interpretRF'
            , debounceCommands : true
            , debounceTimeout : 300
            , queueCommands : true
        }
	, '30' : {
	    debounceCommand : true
	    , debounceTimeout : 300
	}
	, '31' : {
	    debounceCommand : true
	    , debounceTimeout : 300
	}
        , '999' : {

            queueCommands : true
        }
        , '1000' : {

            queueCommands : true
        }
        , '1002' : {

            queueCommands : true
        }
        , '1003' : {

            ackMethod : 'arduinoVersion'
        }
        , '1007' : {

            queueCommands : true
        }
    }
};
