# Https Server

> An HTTPS server with a built-in router.

[![npm version](https://img.shields.io/npm/v/@panosoft/https-server.svg)](https://www.npmjs.com/package/@panosoft/https-server)
[![Travis](https://img.shields.io/travis/panosoft/https-server.svg)](https://travis-ci.org/panosoft/https-server)

This module can be used to create an HTTPS server that can route requests to a pre-defined set of handlers. It also provides an interface that makes it trivial to run such a server from the command line.

Each request received is assigned a unique id that is included in all associated log entries and is returned to the requester in the `Request-Id` header of the response.

If a request is received for an unhandled pathname or method the server will log the occurrence and respond with the proper HTTP response codes.

Similarly, if an error is encountered while handling a defined route, the occurrence will be logged and the proper HTTP response will be sent to the requester.

# Installation

```sh
npm install @panosoft/https-server
```

# Usage

The [`cli`](#cli) method can be used to quickly create a server that can be run from the command line:

```js
#! /usr/bin/env node

const HttpsServer = require('@panosoft/https-server');

const packageFilename = '/path/to/top-level/pacakge.json';
const routes = {
  '/': {
    GET: (request, response, log) => response.end('Hello World')
  }
};

HttpsServer.cli(packageFilename, routes);
```

Or, the API can be used directly:

```js
const bunyan = require('bunyan');
const fs = require('fs');
const HttpsServer = require('@panosoft/https-server');

const options = {
  key: fs.readFileSync('path/to/key.pem'),
  cert: fs.readFileSync('path/to/cert.pem'),
  logger: bunyan.createLogger({name: 'server'})
};
const routes = {
  '/': {
    GET: (request, response, log) => response.end('Hello World')
  }
};
const server = HttpsServer.create(options, routes);

yield server.listen(8443, '127.0.0.1');
server.address();
yield server.connections();
yield server.close();
```

<a name="routes"></a>
# Routes

An object that determines how requests will be routed and handled. It has the following structure:

```js
{
  <pathname> : {
    <method>: <handler>,
    ...
  },
  ...
}
```

Where:

- `pathname` - {String} Any valid path.

- `method` - {String} Any valid HTTP method.

- `handler` - {Function}

  A function to be called when the specified pathname and method are requested.

  This function will be called with the `request` and `response` streams generated by Node's [`https.Server`](https://nodejs.org/api/https.html#https_class_https_server) along with a Bunyan logger that includes the serialized request with every log entry.

  This function should handle the entire request, write any necessary log entries, and call `response.end()` when it has completed.

  This function will be run asynchronously if it returns a `Promise`. Otherwise, it will be run synchronously.

  In the case of synchronous handlers, when an error is encountered, it should be thrown.

  In the case of asynchronous handlers, when an error is encountered the returned `Promise` should be rejected with the error.

  All handler errors will be automatically be logged by the server and an HTTP error response will automatically be sent to the requester.

__Example__

```js
const routes = {
  '/': {
    GET: (request, response, log) => {}
  },
  '/user': {
    GET:(request, response, log) => {},
    POST: (request, response, log) => {},
    DELETE: (request, response, log) => {}    
  }
};
```

# Error Responses

## Path Not Found

When a requested path is not defined in `Routes`, the following error response is sent to the requester:

- Status Code: `404`
- Headers:
  - `Request-Id` - {String} The unique id assigned to the associated request.
  - `Content-Type` - `'application/json'`
- Body:
  - `error` - `'${pathname} not found'`

## Method Not Defined

When an undefined method for a path defined in `Routes` is requested, the following error response is sent to the requester:

- Status Code: `405`
- Headers:
  - `Request-Id` - {String} The unique id assigned to the associated request.
  - `Content-Type` - `'application/json'`
  - `Allow` - {String} A comma separated list of valid methods for the requested path.
- Body:
  - `error` - `'${method} not allowed for ${pathname}'`

## Internal Server error

When an error is thrown or a returned promise is rejected by a route handler, the following error response is sent to the requester:

- Status Code: `500`
- Headers:
  - `Request-Id` - {String} The unique id assigned to the associated request.
  - `Content-Type` - `'application/json'`
- Body:
  - `error` - {String} The associated error message.

# API

## cli ( packageFilename , routes )

Run the server as a node command line program.

Help and version commands are automatically generated using the contents of the `package.json` file found at the provided path.

Log entries are written to `stdout` and `stderr` as appropriate.

Also, the following process events are also handled gracefully and appropriately (i.e. open connections are closed and appropriate exit codes are returned by the process):

- `SIGINT`

- `SIGTERM`

- `unhandledRejection`

- `uncaughtException`

When run as a command the following interface is available:

```sh
Usage: command-name --key <path> --cert <path> [options]

Description from package.json ...

Options:

  -h, --help                    output usage information
  -V, --version                 output the version number
  -k, --key   <path>            Path to the private key of the server in PEM format.
  -c, --cert  <path>            Path to the certificate key of the server in PEM format.
  -p, --port  <port>            The port to accept connections on. Default: 8443.
  -i, --interface  <interface>  The interface to accept connections on. Default: 0.0.0.0.
```

__Arguments__

- `packageFilename` - {String} A path to the `package.json` for the module calling this function.

- `routes` - {[Routes](#routes)} A routes object.

__Example__

```js
#! /usr/bin/env node

const HttpsServer = require('@panosoft/https-server');

const packageFilename = '/path/to/top-level/pacakge.json';
const routes = {
  '/': { GET: (request, response, log) => response.end('Hello World') }
};

HttpsServer.cli(packageFilename, routes);
```

## create ( options , routes )

Create a new instance of HttpsServer.

__Arguments__

- `options`

  - `key` - (Required) {String} The private key of the server in PEM format.

  - `cert` - (Required) {String} The certificate key of the server in PEM format.

  - `logger` - {Bunyan Logger} An instance of a [Bunyan]() logger.

  - ... any other supported Node [https.Server]() options

- `routes` - {[Routes](#routes)} A routes object.

__Example__

```js
const options = {
  key: fs.readFileSync('path/to/key.pem'),
  cert: fs.readFileSync('path/to/cert.pem'),
  logger: bunyan.createLogger({name: 'server'})
};
const routes = {
  '/': { GET: (request, response, log) => response.end('Hello World') }
};
const server = HttpsServer.create(options, routes);
```

## listen ( ... )

A thin wrapper around Node's [server.listen](https://nodejs.org/api/https.html#https_server_listen_handle_callback) method that returns a `Promise` instead of taking a callback.

## address ( )

Equivalent to Node's [server.address](https://nodejs.org/api/net.html#net_server_address) method.

## connections ( )

A thin wrapper around Node's [server.getConnections](https://nodejs.org/api/net.html#net_server_getconnections_callback) method that returns a `Promise` instead of taking a callback.

## close ( )

A thin wrapper around Node's [server.close](https://nodejs.org/api/https.html#https_server_close_callback) method that returns a `Promise` instead of taking a callback.

Also, this method differs from Node's [server.close](https://nodejs.org/api/https.html#https_server_close_callback) in that it will not return an error if it is called while the server is not listening.

## test.startServer ( filename [, options] )

A helper function that makes it simple to test cli servers that use the `cli` method.

This function spawns the cli server in a child process. It returns a `Promise` that is fullfilled with a reference to the server process once the server has started successfully. If an error is encountered, the promise will be rejected with the error.

__Arguments__

- `filename` - {String} File path to an executable file that calls the `cli` method.

- `options` - {Object} An object of server options.

    - `port` - {Number} The port to start the server on.

    - `interface` - {String} The interface to start the server on.

__Example__

Assuming we have and executable file at `path/to/executable.js` with the following contents:

```js
#! /usr/bin/env node

const HttpsServer = require('@panosoft/https-server');
const path = require('path');

const packageFilename = path.resolve(__dirname, '../package.json');
const routes = { '/': { 'POST': (req, res, log) => res.end('root') }};
HttpsServer.cli(packageFilename, routes);
```

Then we can use the `test.startServer` method to run this executable file and know when the server has started:

```js
const co = require('co');
const HttpsServer = require('@panosoft/https-server');

co(function * () {
  const filename = `path/to/executable.js`;
  const server = yield HttpsServer.test.startServer(filename);
  // make requests ...
  server.kill();
})
```

## test.request ( pathname , method , headers , data )

A helper function that makes it simple to make requests to a test instance of https-server being run with `test.startServer`. This method handles making requests with the self-signed TLS certificate used by `test.startServer`.

This method makes a request that will recognize the the self-signed TLS certificate used by `test.startServer` as valid. It returns a `Promise` that is fulfilled with the completed response that includes the response body at `response.body`.

__Arguments__

- `pathname` - {String} The pathname to request.

- `method` - {String} The HTTP method to use. Defaults to `GET`.

- `headers` - {Object} The headers to include with the request. Defaults to `{}`.

- `data` - {\*} The data to send along with the request. Defaults to `null`.

__Example__

Continuing the `test.startServer` example above ...

```js
const co = require('co');
const HttpsServer = require('@panosoft/https-server');

co(function * () {
  const filename = `path/to/executable.js`;
  const server = yield HttpsServer.test.startServer(filename);

  const pathname = '/';
  const method = 'POST';
  const headers = { 'Content-Type': 'application/json' };
  const data = JSON.stringify({ a: 1 });
  const response = yield request( pathname, method, headers, data);
  console.log(response.body.toString('utf8')); //=> 'root'

  server.kill();
})
```
