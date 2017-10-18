const expect = require('chai').expect;
const httpMocks = require('node-mocks-http');
const http = require('http');
const eventEmitter = require('events').EventEmitter
const modofun = require('../index');
const common = require('./common');

function runApp(url, handlers, options, onEnd, onNext, method='GET', body) {
  const request = httpMocks.createRequest({ method, url, body });
  const response = httpMocks.createResponse({ eventEmitter });
  response.on('end', () => onEnd && onEnd(response));
  modofun(handlers, options)(request, response, onNext);
}

function extractBody(response) {
  let data = response._getData();
  if (data != null && data !== '') {
    data = JSON.parse(data);
  }
  return data;
}

describe('Request/Response type', function() {
  common.test(runApp, extractBody);
});

describe('Vanilla HTTP IncomingMessage', function() {
  function testNoReqPath() {
    return function(done) {
      const request = new http.IncomingMessage();
      request.url = '/test/with/path?and=querystring';
      modofun({ test: (req) => {
        expect(req.params).to.have.lengthOf(2);
        done();
      }})(request, null, err => err && done(err));
    }
  }
  it('should support not having req.path, only req.url', testNoReqPath());
});
