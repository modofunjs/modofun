const expect = require('chai').expect;
const url = require('url');
const modofun = require('../index');
const common = require('./common');

class MockContext {
  constructor(requestUrl, method, body, onEnd) {
    const { query } = url.parse(requestUrl, true);
    this.req = {
      originalUrl: 'https://test-function-url' + requestUrl,
      method,
      params: { pathname: requestUrl },
      query: Object.keys(query).length > 0 ? query : undefined,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        connection: 'Keep-Alive',
        accept: 'application/json',
        host: 'test-function-url',
        origin: 'https://functions.azure.com',
      },
      body,
      rawBody: JSON.stringify(body)
    };
    this.res = {};
    this.invocationId = 'test';
    this.bindings = { request: this.req, response: this.res };
    this.onEnd = onEnd;
  }

  log() {
    console.log(arguments);
  }

  done() {
    this.onEnd && this.onEnd(this.res.status, this.res.body);
  }
}

function runApp(url, handlers, options, onEnd, method='GET', body) {
  const context = new MockContext(url, method, body, onEnd);
  modofun.azure(handlers, options)(context);
}

describe('Microsoft Azure Functions type', function() {
  common.test(runApp);

  describe('Automatic handler type recognition', function() {
    function testAutoType() {
      return function(done) {
        const context = new MockContext('/test', 'POST');

        const previousEnv = common.setAzureEnv();

        modofun({
          test: (req) => {
            expect(req.method).to.equal('POST');
            done();
          }
        }, { mode: 'reqres', errorHandler: done })(context);

        common.restoreEnv(previousEnv);
      }
    }
    it('should detect Azure Functions handler type', testAutoType());
  });
});
