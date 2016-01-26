const co = require('co');
const concat = require('concat-stream');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const path = require('path');
const R = require('ramda');
const serialize = require('../lib/serialize');
const Server = require('../lib/server');
const url = require('url');

const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/ca.crt'));
const key = fs.readFileSync(path.resolve(__dirname, 'credentials/server.key'));
const cert = fs.readFileSync(path.resolve(__dirname, 'credentials/server.crt'));
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

var req;
var res;
var response;
const port = 8443;
const handle = (request, response) => {
  req = request;
  res = response;
  res.writeHead(200);
  res.end();
};
const routes = { '/': { GET: handle }};
const server = Server.create({ key, cert }, routes);

describe('serialize', () => {
  before(co.wrap(function * () {
    yield server.listen(port);
    response = yield request('GET', `https://localhost:${port}/`);
  }));
  after(() => server.close());
  it('exists', () =>
    expect(serialize).to.be.a('function')
  );
  it('handle an error', () => {
    const message = 'Test';
    const error = new Error(message);
    const result = serialize(error);
    expect(result).to.be.an('object')
      .and.to.have.all.keys('message', 'stack');
  });
  it('handle a request', () => {
    const result = serialize(req);
    expect(result).to.be.an('object')
      .and.to.have.all.keys('id', 'method', 'url', 'httpVersion', 'headers', 'connection');
    expect(result.connection).to.be.an('object')
      .and.to.have.all.keys('remoteAddress', 'remoteFamily', 'remotePort');
  });
  it('handle a response', () => {
    const result = serialize(res);
    expect(result).to.be.an('object')
      .that.has.all.keys('statusMessage', 'statusCode', 'headers');
  });
  it('noop if unrecognized type', () => {
    const object = { a: 1 };
    const result = serialize(object);
    expect(result).to.equal(object);
  });
});
