#! /usr/bin/env node

const HttpsServer = require('../../lib');

const packageFilename = `${__dirname}/package.json`;
const routes = {
  '/': {
    GET: (request, response) => {
      response.writeHead(200);
      response.end();
    }
  },
  '/uncaughtException': {
    GET: (request, response) => {
      response.end();
      setTimeout(() => { throw new Error(); }, 0);
    }
  },
  '/unhandledRejection': {
    GET: (request, response) => {
      response.end();
      new Promise((resolve, reject) => reject());
    }
  }
};
HttpsServer.cli(packageFilename, routes);
