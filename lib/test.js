const bunyan = require('bunyan');
const co = require('co');
const concat = require('concat-stream');
const cp = require('child_process');
const dargs = require('dargs');
const fs = require('fs');
const https = require('https');
const parseJson = require('parse-json');
const path = require('path');
const R = require('ramda');
const url = require('url');

const parse = url.parse;

const ca = fs.readFileSync(path.resolve(__dirname, '../test/credentials/ca.crt'));
const key = path.resolve(__dirname, '../test/credentials/server.key');
const cert = path.resolve(__dirname, '../test/credentials/server.crt');

/**
 * @param {String} bin
 * @param {Object} options
 *        { port, interface }
 */
const startServer = (bin, options) => new Promise((resolve, reject) => {
  options = R.merge(options || {}, {key, cert});
  const args = dargs(options);
  const split = R.compose(R.reject(R.isEmpty), R.split('\n'));
  const parseRecords = stdout => R.map(parseJson, split(stdout.toString('utf8')));
  const isInfo = R.compose(R.equals(bunyan.INFO), R.prop('level'));
  const isStarted = R.compose(R.equals(`Server started.`), R.prop('msg'));
  const server = cp.spawn(bin, args);
  server.stderr.pipe(concat(data => data ? reject(data.toString('utf8')) : null));
  server.stdout.once('data', function check (data) {
    var records;
    try { records = parseRecords(data); }
    catch (error) { return reject(error); }
    if (!R.all(isInfo, records)) { reject(records); }
    else if (R.any(isStarted, records)) { resolve(server); }
    else { server.stdout.once('data', check); }
  });
});

const request = co.wrap(function * (pathname, method, headers, data) {
  method = method || 'GET';
  const url = `https://localhost:8443${pathname}`;
  const response = yield new Promise((resolve, reject) => https
    .request(R.merge(parse(url), { ca, headers, method }), resolve)
    .on('error', reject)
    .end(data));
  const buffer = yield new Promise(resolve => response.pipe(concat(resolve)));
  if (buffer.length > 0) response.body = buffer;
  return response;
});

module.exports = { startServer, request };
