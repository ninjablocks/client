'use strict';

var log4js = require('log4js');
log4js.configure({
  appenders: [
    { type: 'console' }
  ],
  replaceConsole: true
});

require('colors');

/**
 * Returns an enhanced log4js that allows the log category to be "extended" into
 * new log objects.
 *
 * @class Log
 */
module.exports = {

  addFileAppender: function(path) {
    if (!log4js.appenders.file) {
      log4js.loadAppender('file');
    }
    log4js.addAppender(log4js.appenders.file(path));
  },

  /**
   * Returns a new logger
   *
   * @static @method getLogger
   * @param {String} name The initial category name
   * @param {String} [colour] The colour of the category name when in logs (using module "colors")
   * @returns {Logger}
   */
  getLogger: function(name, colour, category, colours) {
    name = name || '[NONAME]';

    colours = colours? colours.slice() : ['cyan', 'magenta', 'green', 'grey', 'rainbow'];
    category = category? category.slice() : [];

    if (colour) {
      colours.unshift(colour);
    }

    category.push(name[colours.shift() || 'white']);

    var l = log4js.getLogger(category.join(' '));

    /**
     * Extends the logger with an additional category
     *
     * @method extend
     * @param {String} name The added category name
     * @param {String} [colour] The colour of the category name when in logs (using module "colors")
     */
    l.extend = function(name, colour) {
      return module.exports.getLogger(name, colour, category, colours);
    };

    return l;
  }
};

/*
function getStack() {
  var err = new Error();
  Error.captureStackTrace(err, arguments.callee);
  return err.stack;
}
*/