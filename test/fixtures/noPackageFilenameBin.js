#! /usr/bin/env node

const HttpsServer = require('../../lib');

const routes = {
  '/': { GET: (request, response) => response.end() }
};
HttpsServer.cli(null, routes);
