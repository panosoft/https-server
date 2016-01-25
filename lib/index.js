const cli = require('./cli');
const Server = require('./server');

module.exports = {
  cli,
  create: Server.create
};
