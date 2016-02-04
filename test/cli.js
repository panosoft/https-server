const bunyan = require('bunyan');
const cli = require('../lib/cli');
const co = require('co');
const concat = require('concat-stream');
const cp = require('child_process');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const parseJson = require('parse-json');
const path = require('path');
const R = require('ramda');
const readPkg = require('read-pkg');
const testCommon = require('../lib/test');
const url = require('url');

const startServer = testCommon.startServer;
const request = testCommon.request;

const pkg = readPkg.sync(`${__dirname}/fixtures/package.json`);
const bin = `${__dirname}/fixtures/bin.js`;
const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/ca.crt'));
const key = `${__dirname}/credentials/server.key`;

const split = R.compose(R.reject(R.isEmpty), R.split('\n'));
const parseRecords = stdout => R.map(parseJson, split(stdout.toString('utf8')));
const parseUrl = url.parse;
const get = (url) => new Promise((resolve, reject) =>
  https.get(R.merge(parseUrl(url), { ca }), resolve)
    .on('error', reject)
);

describe('CLI', () => {
  describe('cli()', () => {
    it('exists', () =>
      expect(cli).to.be.an('function')
    );
    it('require packageFilename', () =>
      expect(cli).to.throw(TypeError, 'packageFilename must be defined.')
    );
  });
  describe('used in executable file', () => {
    it('display help', co.wrap(function * () {
      const child = cp.spawn(bin, ['--help']);
      const stdout = yield new Promise(resolve => child.stdout.pipe(concat(resolve)));
      expect(stdout.toString('utf8')).to.contain(pkg.description);
    }));
    it('display version', co.wrap(function * () {
      const child = cp.spawn(bin, ['--version']);
      const stdout = yield new Promise(resolve => child.stdout.pipe(concat(resolve)));
      expect(stdout.toString('utf8')).to.contain(pkg.version);
    }));
    it('require key', co.wrap(function * () {
      const child = cp.spawn(bin, []);
      const stdout = yield new Promise(resolve => child.stdout.pipe(concat(resolve)));
      const code = yield new Promise(resolve => child.on('close', resolve));
      const records = parseRecords(stdout);
      const errorRecord = records[1];
      expect(errorRecord.level).to.equal(bunyan.FATAL);
      expect(errorRecord.error.message).to.equal('--key must be specified');
      expect(code).to.equal(1);
    }));
    it('require cert', co.wrap(function * () {
      const child = cp.spawn(bin, ['--key', key]);
      const stdout = yield new Promise(resolve => child.stdout.pipe(concat(resolve)));
      const code = yield new Promise(resolve => child.on('close', resolve));
      const records = parseRecords(stdout);
      const errorRecord = records[1];
      expect(errorRecord.level).to.equal(bunyan.FATAL);
      expect(errorRecord.error.message).to.equal('--cert must be specified');
      expect(code).to.equal(1);
    }));
    it('handle SIGINT', co.wrap(function * () {
      const server = yield startServer(bin);
      server.kill('SIGINT');
      const code = yield new Promise(resolve => server.on('close', resolve));
      expect(code).to.equal(0);
    }));
    it('handle SIGTERM', co.wrap(function * () {
      const server = yield startServer(bin);
      server.kill('SIGTERM');
      const code = yield new Promise(resolve => server.on('close', resolve));
      expect(code).to.equal(0);
    }));
    it('listen on default port and host', co.wrap(function * () {
      const path = '/';
      const server = yield startServer(bin);
      const response = yield request(path);
      server.kill();
      const code = yield new Promise(resolve => server.on('close', resolve));
      expect(response.statusCode).to.equal(200);
      expect(code).to.equal(0);
    }));
    it('listen on specified port', co.wrap(function * () {
      const host = `localhost`;
      const port = 8888;
      const path = '/';
      const url = `https://${host}:${port}${path}`;
      const server = yield startServer(bin, { port });
      const response = yield get(url);
      server.kill();
      const code = yield new Promise(resolve => server.on('close', resolve));
      expect(response.statusCode).to.equal(200);
      expect(code).to.equal(0);
    }));
    it('listen on specified host', co.wrap(function * () {
      const host = `127.0.0.1`;
      const port = 8443;
      const path = '/';
      const url = `https://${host}:${port}${path}`;
      const server = yield startServer(bin, { port, interface: host });
      try {
        yield get(url);
      }
      catch (error) {
        server.kill();
        expect(error.message).to.contain(`Hostname/IP doesn't match certificate`);
      }
    }));
    it('handle uncaughtException', co.wrap(function * () {
      const host = `localhost`;
      const port = 8443;
      const path = '/uncaughtException';
      const url = `https://${host}:${port}${path}`;
      const server = yield startServer(bin);
      yield get(url);
      // exception should kill server
      const code = yield new Promise(resolve => server.on('close', resolve));
      // log?
      expect(code).to.equal(1);
    }));
    it('handle unhandledRejection', co.wrap(function * () {
      const host = `localhost`;
      const port = 8443;
      const path = '/unhandledRejection';
      const url = `https://${host}:${port}${path}`;
      const server = yield startServer(bin);
      yield get(url);
      // rejection should kill server
      const code = yield new Promise(resolve => server.on('close', resolve));
      // log?
      expect(code).to.equal(1);
    }));
  });
});
