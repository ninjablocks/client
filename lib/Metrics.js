'use strict';

var os = require('os');

function Metrics(app, opts) {
  this.opts = opts || {statsInterval: 30000};
  this.app = app;
  this.log = app.log.extend('Metrics');
}

/**
 * Register the metrics logging task.
 */
Metrics.prototype.registerMetricsTask = function () {
  setInterval(function () {
    var memory = process.memoryUsage();
    this.log.info('sample#node.rss=' + memory.rss, 'sample#node.heapTotal=' + memory.heapTotal, 'sample#node.heapUsed=' + memory.heapUsed);
    var load = os.loadavg();
    this.log.info('sample#os.load1=' + load[0], 'sample#os.load5=' + load[1], 'sample#os.load15=' + load[2]);
  }.bind(this), this.opts.statsInterval);
};

module.exports = Metrics;