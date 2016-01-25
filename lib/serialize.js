const http = require('http');
const parseHeaders = require('parse-headers');
const R = require('ramda');

const serializeRequest = (request) => R.merge(
  R.pick(['id', 'method', 'url', 'httpVersion', 'headers'], request),
  { connection: R.pick(['remoteAddress', 'remoteFamily', 'remotePort'], request.connection) }
);
const serializeResponse = (response) => R.merge(
  R.pick(['id', 'statusMessage', 'statusCode', ], response),
  { headers: parseHeaders(response._header) }
);
const serializeError = R.pick(['message', 'stack']);

const serialize = (object) => {
  if(object instanceof Error) return serializeError(object);
  else if (object instanceof http.ServerResponse) return serializeResponse(object);
  else if (object instanceof http.IncomingMessage) return serializeRequest(object);
  else return object;
};
module.exports = serialize;
