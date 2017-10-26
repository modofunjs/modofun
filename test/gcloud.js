const expect = require('chai').expect;
const httpMocks = require('node-mocks-http');
const eventEmitter = require('events').EventEmitter
const modofun = require('../index');
const common = require('./common');

function runApp(url, handlers, options, onEnd, onNext, method='GET', body) {
  const request = httpMocks.createRequest({ method, url, body });
  const response = httpMocks.createResponse({ eventEmitter });
  response.on('end', () => onEnd && onEnd(response));
  modofun.gcloud(handlers, options)(request, response, onNext);
}

function extractBody(response, json=true) {
  let data = response._getData();
  if (!json) {
    return data;
  }
  if (data != null && data !== '') {
    data = JSON.parse(data);
  }
  return data;
}

describe('Google Cloud Function type', function() {
  common.test(runApp, extractBody);

  describe('Automatic handler type recognition', function() {
    function testAutoType() {
      return function(done) {
        const request = httpMocks.createRequest({ method: 'GET', url: '/test' });
        const response = httpMocks.createResponse();

        let lambdaEnvValue = null;
        if (process.env.LAMBDA_TASK_ROOT) {
          lambdaEnvValue = process.env.LAMBDA_TASK_ROOT;
          delete(process.env.LAMBDA_TASK_ROOT);
        }

        modofun({
          test: (req) => {
            expect(req.method).to.equal('GET');
            done();
          }
        }, { mode: 'reqres' })(request, response);

        if (lambdaEnvValue) {
          process.env.LAMBDA_TASK_ROOT = lambdaEnvValue;
        }
      }
    }
    it('should detect Google Cloud Function handler type', testAutoType());
  });
});
