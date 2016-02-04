const HttpsServer = require('../lib');
const expect = require('chai').expect;

describe('HttpsServer', () => {
  describe('api', () => {
    it('exists', () => {
      expect(HttpsServer).to.be.an('object')
        .and.to.have.all.keys('cli', 'create', 'test');
      expect(HttpsServer.test).to.have.all.keys('request', 'startServer');
    });
  });
});
