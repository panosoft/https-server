const bunyan = require('bunyan');
const co = require('co');
const concat = require('concat-stream');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const mime = require('mime-types');
const path = require('path');
const R = require('ramda');
const Router = require('../lib/router');
const Server = require('../lib/server');
const url = require('url');

const port = 8443;
const host = `https://localhost:${port}`;
const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/rootCA.pem'));
const key = fs.readFileSync(path.resolve(__dirname, 'credentials/privateKey.pem'));
const cert = fs.readFileSync(path.resolve(__dirname, 'credentials/certificate.pem'));
const parse = url.parse;
const request = co.wrap(function * (method, url, data) {
  const response = yield new Promise((resolve, reject) =>
    https.request(R.merge(parse(url), { ca, method }), resolve)
      .on('error', reject)
      .end(data));
  const buffer = yield new Promise(resolve => response.pipe(concat(resolve)));
  if (buffer.length > 0) response.body = JSON.parse(buffer.toString('utf8'));
  return response;
});

const ordinary = (request, response) => {
  response.writeHead(200);
  response.end();
};
const yieldable = (request, response) =>
  new Promise(resolve => setTimeout(() => {
    response.writeHead(200);
    response.end();
    resolve();
  }, 1));
const log = (request, response, log) => {
  log('info', 'Test');
  response.end();
};
const error = () => { throw new Error('Internal error'); };
const rejection = () => Promise.reject(new Error('Rejected promise'));
const routes = {
  '/ordinary': { POST: ordinary, DELETE: ordinary },
  '/yieldable': { GET: yieldable },
  '/log': { GET: log },
  '/error': { POST: error },
  '/rejection': { POST: rejection }
};

const expectError = (error) => {
  expect(error).to.be.an('object')
    .and.to.have.all.keys('message', 'stack');
};
const expectRequest = (request) => {
  expect(request).to.be.an('object')
    .and.to.have.all.keys('id', 'method', 'url', 'httpVersion', 'headers', 'connection');
  expect(request.id).to.be.a('string');
  expect(request.headers).to.be.an('object');
  expect(request.connection).to.be.an('object')
    .and.to.have.all.keys('remoteAddress', 'remoteFamily', 'remotePort');
};
const expectResponse = (response) => {
  expect(response).to.be.an('object')
    .and.to.have.all.keys('statusMessage', 'statusCode', 'headers');
  expect(response.headers).to.be.an('object')
    .and.to.have.property('request-id')
    .that.is.a('string');
};
const expectErrorRecord = (record, msg) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('request', 'error');
  if (msg) expect(record.msg).to.match(msg);
  expectRequest(record.request);
  expectError(record.error);
};
const expectRequestRecord = (record) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request');
  expect(record.msg).to.match(/Request received./);
  expectRequest(record.request);
};
const expectResponseRecord = (record) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request', 'response');
  expect(record.msg).to.match(/Response sent./);
  expectRequest(record.request);
  expectResponse(record.response);
};

describe('Router', () => {
  describe('create', () => {
    it('exists', () => expect(Router).to.be.an('object')
      .and.to.have.all.keys('create')
    );
    it('create instance', () => {
      var router = Router.create({}, routes);
      expect(router).to.be.an('object')
        .and.to.have.all.keys('route');
    });
  });
  describe('route', () => {
    var buffer;
    var server;
    beforeEach(() => {
      buffer = new bunyan.RingBuffer();
      const logger = bunyan.createLogger({
        name: 'test',
        streams: [{type: 'raw', stream: buffer}]
      });
      server = Server.create({ key, cert, logger }, routes);
      return server.listen(port);
    });
    afterEach(() => server.close());
    it('accept ordinary handler function', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('POST', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(200);
      // logs
      expect(buffer.records).to.have.length(2);
      expectRequestRecord(buffer.records[0]);
      expectResponseRecord(buffer.records[1]);
    }));
    it('accept yieldable handler function', co.wrap(function * () {
      const path = '/yieldable';
      const response = yield request('GET', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(200);
      // logs
      expect(buffer.records).to.have.length(2);
      expectRequestRecord(buffer.records[0]);
      expectResponseRecord(buffer.records[1]);
    }));
    it('set Request-Id header on all responses', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('POST', `${host}${path}`);
      expect(response.headers).to.be.an('object')
        .and.to.contain.all.keys('request-id');
      expect(response.headers['request-id']).to.be.a('string');
  }));
    it('include serialized request in handler logs', co.wrap(function * () {
      const path = '/log';
      yield request('GET', `${host}${path}`);
      expect(buffer.records).to.have.length(3);
      const record = buffer.records[1];
      expect(record).to.be.an('object')
        .and.to.contain.key('request');
      expectRequest(record.request);
    }));
    it('handle ordinary handler function error', co.wrap(function * () {
      const path = '/error';
      const response = yield request('POST', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.be.an('object')
        .and.to.contain.all.keys('content-type');
      expect(response.headers['content-type']).to.equal(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Internal server error./);
      expectResponseRecord(buffer.records[2]);
    }));
    it('handle yieldable handler function promise rejection', co.wrap(function * () {
      const path = '/rejection';
      const response = yield request('POST', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.be.an('object')
        .and.to.contain.all.keys('content-type');
      expect(response.headers['content-type']).to.equal(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Internal server error./);
      expectResponseRecord(buffer.records[2]);
    }));
    it('handle invalid pathnames', co.wrap(function * () {
      const path = '/invalid';
      const response = yield request('GET', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(404);
      expect(response.headers).to.be.an('object')
        .and.to.contain.all.keys('content-type');
      expect(response.headers['content-type']).to.equal(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Not found./);
      expectResponseRecord(buffer.records[2]);
    }));
    it('handle unsupported methods', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('GET', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(405);
      expect(response.headers).to.be.an('object')
        .and.to.contain.all.keys('content-type', 'allow');
      expect(response.headers['content-type']).to.equal(mime.lookup('json'));
      expect(response.headers.allow).to.equal(R.join(',', R.keys(routes[path])));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Method not allowed./);
      expectResponseRecord(buffer.records[2]);
    }));
  });
});
