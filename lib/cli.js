const bunyan = require('bunyan');
const co = require('co');
const fs = require('fs');
const HttpsServer = require('./server');
const Log = require('./log');
const os = require('os');
const path = require('path');
const program = require('commander');
const R = require('ramda');
const readPkg = require('read-pkg');
const serialize = require('./serialize');


const startServer = co.wrap(function * (pkg, routes, logger, log) {
  var server;
  var shutdown;
  try {
    shutdown = co.wrap(function * (code) {
      code = R.defaultTo(0, code);
      if (server) {
        log('info', { connections: yield server.connections() }, 'Stopping server.');
        yield server.close();
        log('info', { connections: yield server.connections() }, 'Server stopped.');
      }
      process.exit(code);
    });
    process.on('uncaughtException', (error) => {
      log('fatal', { error: serialize(error) }, 'Uncaught Exception');
      shutdown(1);
    });
    process.on('unhandledRejection', (error) => {
      log('fatal', { error: serialize(error) }, 'Unhandled Rejection');
      shutdown(1);
    });
    process.on('SIGINT', () => {
      log('info', 'SIGINT received.');
      shutdown();
    });
    process.on('SIGTERM', () => {
      log('info', 'SIGTERM received.');
      shutdown();
    });

    program
      .version(pkg.version)
      .description(pkg.description)
      .usage('--key <path> --cert <path> [options]')
      .option('-k, --key   <path>', 'Path to the private key of the server in PEM format.')
      .option('-c, --cert  <path>', 'Path to the certificate key of the server in PEM format.')
      .option('-p, --port  <port>', 'The port to accept connections on. Default: 8443.')
      .option('-i, --interface  <interface>', 'The interface to accept connections on. Default: 0.0.0.0.')
      .parse(process.argv);
    log('info', {
      arch: process.arch,
      platform:process.platform,
      release: os.release(),
      node: process.version,
      cwd: process.cwd(),
      argv: process.argv,
      package: pkg.name,
      version: pkg.version
    }, 'Process details.');
    if (!program.key) throw new TypeError('--key must be specified');
    if (!program.cert) throw new TypeError('--cert must be specified');

    const keyFilename = path.resolve(program.key);
    log('info', { filename: keyFilename }, 'Reading key.');
    const key = fs.readFileSync(keyFilename);
    log('info', { filename: keyFilename }, 'Key read.');

    const certFilename = path.resolve(program.cert);
    log('info', { filename: certFilename }, 'Reading cert.');
    const cert = fs.readFileSync(certFilename);
    log('info', { filename: certFilename }, 'Cert read.');

    const port = program.port || 8443;
    const host = program.interface;

    log('info', 'Creating server.');
    server = HttpsServer.create({ key, cert, logger }, routes);
    log('info', 'Server created.');

    log('info', 'Starting server.');
    yield server.listen(port, host);
    log('info', server.address(), 'Server started.');
  }
  catch (error) {
    log('fatal', { error: serialize(error) }, 'Failed to start.');
    shutdown(1);
  }
});

/**
 * @param {String} packageFilename
 * @param {Object} [routes]
 */
const cli = (packageFilename, routes) => {
  if (!packageFilename) throw new TypeError('packageFilename must be defined.');
  const pkg = readPkg.sync(packageFilename);
  const logger = bunyan.createLogger({ name: pkg.name });
  const log = Log(logger);
  startServer(pkg, routes, logger, log);
};

module.exports = cli;
