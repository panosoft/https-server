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
