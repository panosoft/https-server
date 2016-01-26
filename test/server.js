const co = require('co');
const expect = require('chai')
  .use(require('chai-as-promised'))
  .expect;
const fs = require('fs');
const https = require('https');
const path = require('path');
const R = require('ramda');
const Server = require('../lib/server');
const url = require('url');

const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/ca.crt'));
const key = fs.readFileSync(path.resolve(__dirname, 'credentials/server.key'));
const cert = fs.readFileSync(path.resolve(__dirname, 'credentials/server.crt'));
const parse = url.parse;
const get = (url) => new Promise((resolve, reject) =>
  https.get(R.merge(parse(url), { ca }), resolve)
    .on('error', reject)
);
const handle = (request, response) => {
  response.writeHead(200);
  response.end();
};
const routes = {
  '/': { GET: handle }
};

const options = { key, cert };
const port = 8443;
var server;

describe('Server', () => {
  describe('api', () => {
    it('exists', () => {
      expect(Server).to.be.an('object')
        .and.to.have.all.keys('create');
    });
  });
  describe('create', () => {
    it('create instance', () => {
      server = Server.create(options, routes);
      expect(server).to.be.an('object')
        .and.to.have.all.keys('address', 'close', 'connections', 'listen');
    });
  });
  describe('listen', () => {
    it('exists', () => expect(server.listen).to.be.a('function'));
    it('start server', co.wrap(function * () {
      yield server.listen(port);
      const response = yield get(`https://localhost:${port}`);
      expect(response.statusCode).to.equal(200);
    }));
    // default host: 0.0.0.0
    // override host
  });
  describe('address', () => {
    it('exists', () =>
      expect(server.address).to.be.a('function')
    );
    it('return address info', () => {
      expect(server.address()).to.be.an('object')
        .and.to.have.all.keys('address', 'family', 'port');
    });
  });
  describe('connections', () => {
    it('exists', () =>
      expect(server.connections).to.be.a('function')
    );
    it('return connection count', () =>
      expect(server.connections()).to.eventually.be.a('number')
    );
    // throw error when?
  });
  describe('close', () => {
    it('exists', () =>
      expect(server.close).to.be.a('function')
    );
    it('stop server', co.wrap(function * () {
      yield server.close();
      return expect(get(`https://localhost:${port}`))
        .to.eventually.be.rejectedWith(/ECONNREFUSED/);
    }));
    it('silent if server not started', () =>
      expect(server.close()).to.eventually.be.fulfilled
    );
  });
  describe('config', () => {
    it('require key', () => {
      const config = {};
      expect(() => Server.create(config)).to.throw(TypeError, /key must be defined/);
    });
    it('require cert', () => {
      const config = { key };
      expect(() => Server.create(config)).to.throw(TypeError, /cert must be defined/);
    });
  });
});
