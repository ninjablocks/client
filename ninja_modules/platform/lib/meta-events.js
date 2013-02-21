module.exports = metaEvents;

function metaEvents(platform) {

	platform.prototype.transformAccelerometer = function(dat, meta) {

		if(!this.motionSample) {

			return this.motionSample = dat;
		}
		var samples = split(this.motionSample);
		if(!three(samples)){ return reset(); }

		var 
			sampleSum = reduce(samples)
			, current = split(dat)
		;
		if(!three(current)) { return reset(); }
		this.motionSample = dat;

		var 
			currentSum = reduce(current)
			, diff = currentSum - sampleSum
		;
		if(threshold(diff)) {

			console.log("JIGGLE");
			
			this.emit('data', {
				G : '0'
				, V : 0
				, D : 3
				, DA : 1
			});
		}
		function three(a) { return a.length == 3; } 
		function split(a) { return a.DA.split(','); }
		function reduce(s) { return s.reduce(add); }; 
		function add(v, i) { return parseInt(v) + parseInt(i); }
		function reset() { this.motionSample = undefined; }
		function threshold(diff) {

			return (diff > meta.sensitivity || diff < -meta.sensitivity)
		}
	};
};
