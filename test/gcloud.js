const expect = require('chai').expect;
const httpMocks = require('node-mocks-http');
const eventEmitter = require('events').EventEmitter
const modofun = require('../index');
const common = require('./common');

function runApp(url, handlers, options, onEnd, method='GET', body) {
  const request = httpMocks.createRequest({ method, url, body });
  const response = httpMocks.createResponse({ eventEmitter });
  response.on('end', () => onEnd && onEnd(response.statusCode, response._getData()));
  modofun.gcloud(handlers, options)(request, response);
}

describe('Google Cloud Function type', function() {
  common.test(runApp);

  describe('Automatic handler type recognition', function() {
    function testAutoType() {
      return function(done) {
        const request = httpMocks.createRequest({ method: 'GET', url: '/test' });
        const response = httpMocks.createResponse();

        const previousEnv = common.setGcloudEnv();

        modofun({
          test: (req) => {
            expect(req.method).to.equal('GET');
            done();
          }
        }, { mode: 'reqres' })(request, response);

        common.restoreEnv(previousEnv);
      }
    }
    it('should detect Google Cloud Function handler type', testAutoType());
  });
});
