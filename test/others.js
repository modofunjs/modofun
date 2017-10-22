const expect = require('chai').expect;
const http = require('http');
const modofun = require('../index');

describe('Vanilla HTTP IncomingMessage', function() {
  function testNoReqPath() {
    return function(done) {
      const request = new http.IncomingMessage();
      request.url = '/test/with/path?and=querystring';
      modofun.gcloud({ test: (req) => {
        expect(req.params).to.have.lengthOf(2);
        done();
      }}, { mode: 'reqres' })(request, null, err => err && done(err));
    }
  }
  it('should support not having req.path, only req.url', testNoReqPath());
});

describe('General bad config', function() {
  function testInvalidType() {
    return function(done) {
      try {
        modofun({ test: () => {} }, { type: 'hahaha' })();
        done('Should have thrown exception');
      } catch(err) {
        expect(err).to.be.an('error');
        done();
      }
    }
  }
  it('should fail if an invalid type is specified', testInvalidType());
});
