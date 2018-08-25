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
        expect(req.params).to.deep.equal(['with', 'path']);
        done();
      }}, {
        mode: 'reqres',
        errorHandler: err => err && done(err)
      })(request, null);
    }
  }
  it('should support not having req.path, only req.url', testNoReqPath());
});

describe('Empty request', function() {
  function testEmptyRequest() {
    return function(done) {
      modofun.gcloud({ test: () => {
        done(new Error('Should have failed!'));
      }}, {
        errorHandler: err => {
          expect(err).to.be.an('error');
          done();
        }
      })({}, {});
    }
  }
  it('should fail and throw an error', testEmptyRequest());
});

describe('General bad config', function() {
  function testInvalidType() {
    return function(done) {
      try {
        modofun({ test: () => {} }, { type: 'hahaha' })();
        done(new Error('Should have thrown exception'));
      } catch(err) {
        expect(err).to.be.an('error');
        done();
      }
    }
  }
  it('should fail if an invalid type is specified', testInvalidType());
});
