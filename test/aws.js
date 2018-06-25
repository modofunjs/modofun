const expect = require('chai').expect;
const url = require('url');
const modofun = require('../index');
const common = require('./common');

function createEvent(requestUrl, method, body) {
  const { pathname, query } = url.parse(requestUrl, true);
  return {
    "body": body !== '' ? JSON.stringify(body) : body,
    "resource": "/{proxy+}",
    "requestContext": {},
    "queryStringParameters": Object.keys(query).length > 0 ? query : undefined,
    "headers": {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Host": "1234567890.execute-api.us-east-1.amazonaws.com",
      "Cache-Control": "max-age=0",
      "User-Agent": "Custom User Agent String",
      "Accept-Encoding": "gzip, deflate, sdch",
      "Content-Type": "application/json; charset=utf-8"
    },
    "pathParameters": {},
    "httpMethod": method,
    "stageVariables": {},
    "path": pathname
  };
}

function runApp(url, handlers, options, onEnd, method='GET', body) {
  const event = createEvent(url, method, body);
  modofun.aws(handlers, options)(event, {},
    (err, resp) => onEnd && onEnd(resp.statusCode, resp.body));
}

describe('AWS Lambda type', function() {
  common.test(runApp);

  describe('Automatic handler type recognition', function() {
    function testAutoType() {
      return function(done) {
        const event = createEvent('/test', 'POST');

        const previousEnv = common.setAwsEnv();

        modofun({
          test: (req) => {
            expect(req.method).to.equal('POST');
            done();
          }
        }, { mode: 'reqres', errorHandler: done })(event, {}, done);

        common.restoreEnv(previousEnv);
      }
    }
    it('should detect AWS Lambda handler type', testAutoType());
  });

  describe('Missing headers', function() {
    function testHeaders() {
      return function(done) {
        const event = createEvent('/test', 'GET');
        delete(event.headers);

        modofun.aws({
          test: () => done()
        }, { mode: 'reqres', errorHandler: done })(event, {}, done);
      }
    }
    it('should handle missing headers gracefully', testHeaders());
  });
});
