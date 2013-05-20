
var RFInterpreter = {

	log : {},

	Encoding : { //TODO: name based on encoding, not device
		MagSwitch	: 0x01 //HE2ChWSocket
		, WT450		: 0X02
		, ARCELChime	: 0x03
		, HESocket	: 0x04
	},

	RFData : function (deviceData) {
		const encodingIndex = 0, encodingLength = 2;
		const timingIndex = 4, timingLength = 4;
		const payloadIndex = 8;

		if (deviceData.length <= payloadIndex) {
			throw "insufficient data";
		}
		var hexString  = deviceData.substr(encodingIndex, encodingLength);
		this.encoding = parseInt(hexString, 16);
		hexString = deviceData.substr(timingIndex, timingLength);
		this.timing = parseInt(hexString, 16);
		hexString = deviceData.substr(payloadIndex); //the rest of the data
		this.payload = parseInt(hexString, 16);
	},

	processRFData: function (rfData, devices) {
		var result = false;
		switch (rfData.encoding) {
			case RFInterpreter.Encoding.WT450:
				var data = rfData.payload;
				var house=(data>>28) & (0x0f);
				var station=((data>>26) & (0x03))+1;
				var humidity=(data>>16)&(0xff);
				var temperature=((data>>8) & (0xff));
				temperature = temperature - 50;
				var tempfraction=(data>>4) & (0x0f);
				var tempdecimal=((tempfraction>>3 & 1) * 0.5) + ((tempfraction>>2 & 1) * 0.25) + ((tempfraction>>1 & 1) * 0.125) + ((tempfraction & 1) * 0.0625);
				temperature=temperature+tempdecimal;
				temperature=Math.round(temperature*10)/10; //round to 1 decimal place
				//prefix with 0's to two digits
				var paddedHouse = "00"+house.toString();
				paddedHouse = paddedHouse.substr(paddedHouse.length-2);
				var paddedStation = "00"+station.toString();
				paddedStation = paddedStation.substr(paddedStation.length-2);
				address = paddedHouse + paddedStation;
				humidityDevice = {G:address, V:0, D:30, DA:humidity.toString()};
				devices.push(humidityDevice);
				temperatureDevice = {G:address, V:0, D:31, DA:temperature.toString()};
				devices.push(temperatureDevice);
				result = true;
			break;
		}
		return result;
	},

	devicesForDevice : function (device, version, log) {
		var resultDevices = [];
		var defaultReturn = new Array(device);

		RFInterpreter.log = log;
		if ((version === 'undefined') || !(typeof version.arduinoVersion === 'number')) {
			return defaultReturn;
		}
		else if (version.arduinoVersion < 1.00)
		{
			return defaultReturn;
		}
		//version is 1 or greater, rf processed in client rather than arduino
		try {
			var rfData = new RFInterpreter.RFData(device.DA);
			if (false === RFInterpreter.processRFData(rfData, resultDevices)) {
                		resultDevices.push(device);
			}
		}
		catch (err) {
			return defaultReturn;
		}
		return resultDevices;
	},

	knownEncoding : function (encoding) {
		
	}

};

module.exports = RFInterpreter;

