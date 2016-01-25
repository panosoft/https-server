/**
 * Write to bunyan compatible log without worrying about whether a logger is available.
 *
 * 	Log(logger) -> log(level, ...args)
 * 	log.child(...) -> log(level, ...args)
 * 	
 */
const Log = (logger) => {
  const log = function (level) {
    if (logger) logger[level].apply(logger, Array.from(arguments).slice(1));
  };
  log.child = function () {
    return Log(logger ? logger.child.apply(logger, arguments) : null);
  };
  return log;
};

module.exports = Log;
