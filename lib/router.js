const co = require('co');
const Log = require('./log');
const mime = require('mime-types');
const R = require('ramda');
const Ru = require('@panosoft/ramda-utils');
const serialize = require('./serialize');
const url = require('url');
const uuid = require('uuid');

const notFound = (request, response, log) => {
  const pathname = url.parse(request.url).pathname;
  const error = new Error(`${pathname} not found`);
  log('error', { error: serialize(error) }, 'Not found.');
  response.writeHead(404, { 'content-type': mime.lookup('json') });
  response.end(JSON.stringify({ error: error.message }));
};
const internalServerError = (request, response, log, error) => {
  log('error', { error: serialize(error) }, 'Internal server error.');
  response.writeHead(500, { 'content-type': mime.lookup('json') });
  response.end(JSON.stringify({ error: error.message }));
};
const methodNotAllowed = (request, response, log, routes) => {
  const pathname = url.parse(request.url).pathname;
  const allow = R.join(',', R.keys(routes[pathname]));
  const error = new Error(`${request.method} not allowed for ${pathname}`);
  log('error', { error: serialize(error) }, 'Method not allowed.');
  response.writeHead(405, { 'content-type': mime.lookup('json'), allow });
  response.end(JSON.stringify({ error: error.message }));
};

/**
 * @param config
 *        { log: Bunyan Logger }
 * @param routes
 *        { <pathname>: { <method>: function }}
 */
const create = (config, routes) => {
  config = Ru.defaults({ logger: null }, config);
  routes = routes || {};
  const log = Log(config.logger);

  const route = co.wrap(function * (request, response) {
    request.id = uuid.v4();
    response.setHeader('Request-Id', request.id);
    const requestLog = log.child({ request: serialize(request) });
    requestLog('info', 'Request received.');
    response.on('finish', () =>
      requestLog('info', { response: serialize(response) }, 'Response sent.')
    );
    const pathname = url.parse(request.url).pathname;
    const method = request.method;
    try {
      if (!routes[pathname]) notFound(request, response, requestLog);
      else if (!routes[pathname][method]) methodNotAllowed(request, response, requestLog, routes);
      else yield Promise.resolve(routes[pathname][method](request, response, requestLog));
    }
    catch (error) { internalServerError(request, response, requestLog, error); }
  });
  return { route };
};

module.exports = { create };
