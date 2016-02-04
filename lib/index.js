const cli = require('./cli');
const Server = require('./server');
const test = require('./test');

module.exports = {
  cli,
  create: Server.create,
  test
};
