const bunyan = require('bunyan');
const cli = require('../lib/cli');
const co = require('co');
const concat = require('concat-stream');
const cp = require('child_process');
const expect = require('chai')
  .use(require('chai-as-promised'))
  .expect;
const fs = require('fs');
const https = require('https');
const parseJson = require('parse-json');
const path = require('path');
const R = require('ramda');
const readPkg = require('read-pkg');
const url = require('url');

const pkg = readPkg.sync(`${__dirname}/fixtures/package.json`);
const bin = `${__dirname}/fixtures/bin.js`;
const noPackageFilenameBin = `${__dirname}/fixtures/noPackageFilenameBin.js`;
const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/ca.crt'));
const key = `${__dirname}/credentials/server.key`;
const cert = `${__dirname}/credentials/server.crt`;

const split = R.compose(R.reject(R.isEmpty), R.split('\n'));
const parseRecords = stdout => R.map(parseJson, split(stdout.toString('utf8')));
const parseUrl = url.parse;
const serverStarted = child => new Promise((resolve, reject) => {
  child.stderr.setEncoding('utf8');
  child.stderr.pipe(concat(data => data ? reject(data) : null));
  const isInfo = record => record.level === bunyan.INFO;
  const isStarted = record => record.msg === `Server started.`;
  const check = data => {
    var records;
    try {
      records = parseRecords(data);
    }
    catch (error) {
      console.error(error);
      console.log(data.toString('utf8'));
    }
    if (!R.all(isInfo, records)) {
      child.stdout.removeListener('data', check);
      reject(records);
    }
    else if (R.any(isStarted, records)) {
      child.stdout.removeListener('data', check);
      resolve();
    }
  };
  child.stdout.on('data', check);
});
const get = (url) => new Promise((resolve, reject) =>
  https.get(R.merge(parseUrl(url), { ca }), resolve)
    .on('error', reject)
);

describe('CLI', () => {
  describe('cli()', () => {
    it('exists', () =>
      expect(cli).to.be.an('function')
    );
  });
  describe('used in executable file', () => {
    it('require packageFilename', co.wrap(function * () {
      const child = cp.spawn(noPackageFilenameBin, []);
      const stdout = yield new Promise(resolve => child.stdout.pipe(concat(resolve)));
      const code = yield new Promise(resolve => child.on('close', resolve));
      const records = parseRecords(stdout);
      const errorRecord = records[0];
      expect(errorRecord.level).to.equal(bunyan.FATAL);
      expect(errorRecord.error.message).to.equal('packageFilename must be defined.');
      expect(code).to.equal(1);
    }));
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
      const child = cp.spawn(bin, ['--key', key, '--cert', cert]);
      yield serverStarted(child);
      child.kill('SIGINT');
      const code = yield new Promise(resolve => child.on('close', resolve));
      expect(code).to.equal(0);
    }));
    it('handle SIGTERM', co.wrap(function * () {
      const child = cp.spawn(bin, ['--key', key, '--cert', cert]);
      yield serverStarted(child);
      child.kill('SIGTERM');
      const code = yield new Promise(resolve => child.on('close', resolve));
      expect(code).to.equal(0);
    }));
    it('listen on default port and host', co.wrap(function * () {
      const host = `localhost`;
      const port = 8443;
      const path = '/';
      const url = `https://${host}:${port}${path}`;
      const child = cp.spawn(bin, ['--key', key, '--cert', cert]);
      yield serverStarted(child);
      const response = yield get(url);
      child.kill();
      const code = yield new Promise(resolve => child.on('close', resolve));
      expect(response.statusCode).to.equal(200);
      expect(code).to.equal(0);
    }));
    it('listen on specified port', co.wrap(function * () {
      const host = `localhost`;
      const port = 8888;
      const path = '/';
      const url = `https://${host}:${port}${path}`;
      const child = cp.spawn(bin, ['--key', key, '--cert', cert, '--port', port]);
      yield serverStarted(child);
      const response = yield get(url);
      child.kill();
      const code = yield new Promise(resolve => child.on('close', resolve));
      expect(response.statusCode).to.equal(200);
      expect(code).to.equal(0);
    }));
    it('listen on specified host', co.wrap(function * () {
      const host = `127.0.0.1`;
      const port = 8443;
      const path = '/';
      const url = `https://${host}:${port}${path}`;
      const child = cp.spawn(bin, ['--key', key, '--cert', cert, '--port', port, '--interface', host]);
      yield serverStarted(child);
      try {
        yield get(url);
      }
      catch (error) {
        child.kill();
        expect(error.message).to.contain(`Hostname/IP doesn't match certificate`);
      }
    }));
    it('handle uncaughtException', co.wrap(function * () {
      const host = `localhost`;
      const port = 8443;
      const path = '/uncaughtException';
      const url = `https://${host}:${port}${path}`;
      const child = cp.spawn(bin, ['--key', key, '--cert', cert]);
      yield serverStarted(child);
      yield get(url);
      // exception should kill server
      const code = yield new Promise(resolve => child.on('close', resolve));
      // log?
      expect(code).to.equal(1);
    }));
    it('handle unhandledRejection', co.wrap(function * () {
      const host = `localhost`;
      const port = 8443;
      const path = '/unhandledRejection';
      const url = `https://${host}:${port}${path}`;
      const child = cp.spawn(bin, ['--key', key, '--cert', cert]);
      yield serverStarted(child);
      yield get(url);
      // rejection should kill server
      const code = yield new Promise(resolve => child.on('close', resolve));
      // log?
      expect(code).to.equal(1);
    }));
  });
});
