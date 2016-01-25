const bunyan = require('bunyan');
const expect = require('chai').expect;
const Log = require('../lib/log');

const ringbuffer = new bunyan.RingBuffer();
const bunyanLogger = bunyan.createLogger({
  name: 'test',
  streams: [{ type: 'raw', stream: ringbuffer }]
});

describe('Log', () => {
  it('factory', () => {
    const log = Log(bunyanLogger);
    expect(log).to.be.a('function')
      .and.to.have.property('child')
      .that.is.a('function');
  });
  describe('log', () => {
    it('noop if logger undefined', () => {
      const log = Log(null);
      const msg = 'Test';
      log('info', msg);
    });
    it('write if logger defined', () => {
      const log = Log(bunyanLogger);
      expect(log).to.be.a('function');
      const msg = 'Test';
      log('info', msg);
      const record = ringbuffer.records.pop();
      expect(record).to.be.an('object')
        .and.to.have.property('level').that.equals(bunyan.INFO);
      expect(record).to.be.an('object')
        .and.to.have.property('msg').that.equals(msg);
    });
  });
  describe('log.child', () => {
    it('return log that always includes supplied data', () => {
      const log = Log(bunyanLogger);
      const value = 1;

      const objectLog = log.child({ value });
      expect(objectLog).to.be.a('function')
        .and.to.have.property('child')
        .that.is.a('function');

      objectLog('info', 'Test');
      const record = ringbuffer.records.pop();
      expect(record).to.be.an('object')
        .and.to.have.property('level').that.equals(bunyan.INFO);
      expect(record).to.be.an('object')
        .and.to.have.property('value').that.equals(value);
    });
  });
});
