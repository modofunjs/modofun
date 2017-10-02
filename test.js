const expect = require('chai').expect;
const assert = require('assert');
const httpMocks = require('node-mocks-http');
const modofun = require('./index');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

function runApp(operation, path, handler, done) {
  const request = httpMocks.createRequest({ method: 'GET', url: path });
  const response = httpMocks.createResponse();

  modofun({ [operation]: handler })(request, response, done);
}

describe('modofun(handlers)', function() {

  describe('req.params', function() {
    function checkLength(operation, path, length) {
      return function(done) {
        runApp(operation, path, (req) => expect(req.params).to.have.lengthOf(length), done);
      }
    }
    it('should ignore a trailing slash', checkLength('test', '/test/jdoe/1967/', 2));
    it('should support consecutive middle slashes', checkLength('test', '/test/jdoe//1967/', 3));
    it('should support consecutive end slashes', checkLength('test', '/test/jdoe/1967//', 3));
    it('should support consecutive slashes right after operation', checkLength('test', '/test///jdoe/1967', 4));
    it('should support only consecutive slashes after operation', checkLength('test', '/test//', 1));
    it('should support no params after operation', checkLength('test', '/test', 0));
  });

  describe('routing', function() {
    function checkCall(operation, path, valid=true) {
      return function(done) {
        runApp(operation, path, () => { valid && done() }, err => {
          if (err) {
            !valid && expect(err).to.be.an('error');
            done();
          }
        });
      }
    }
    it('should pick the right route', checkCall('test', '/test/jdoe/1967'));
    it('should be case sensitive', checkCall('test', '/Test/jdoe/1967', false));
  });

});
