const expect = require('chai').expect;
const url = require('url');
const modofun = require('../index');
const common = require('./common');

function createEvent(requestUrl, method, body) {
  const { pathname, query } = url.parse(requestUrl, true);
  return {
    "body": typeof body === 'object' ? JSON.stringify(body) : body,
    "resource": "/{proxy+}",
    "requestContext": {},
    "queryStringParameters": query,
    "headers": {
      "Via": "1.1 08f323deadbeefa7af34d5feb414ce27.cloudfront.net (CloudFront)",
      "Accept-Language": "en-US,en;q=0.8",
      "CloudFront-Is-Desktop-Viewer": "true",
      "CloudFront-Is-SmartTV-Viewer": "false",
      "CloudFront-Is-Mobile-Viewer": "false",
      "X-Forwarded-For": "127.0.0.1, 127.0.0.2",
      "CloudFront-Viewer-Country": "US",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Upgrade-Insecure-Requests": "1",
      "X-Forwarded-Port": "443",
      "Host": "1234567890.execute-api.us-east-1.amazonaws.com",
      "X-Forwarded-Proto": "https",
      "X-Amz-Cf-Id": "aaaaaaaaaae3VYQb9jd-nvCd-de396Uhbp027Y2JvkCPNLmGJHqlaA==",
      "CloudFront-Is-Tablet-Viewer": "false",
      "Cache-Control": "max-age=0",
      "User-Agent": "Custom User Agent String",
      "CloudFront-Forwarded-Proto": "https",
      "Accept-Encoding": "gzip, deflate, sdch",
      "Content-Type": "application/json; charset=utf-8"
    },
    "pathParameters": {},
    "httpMethod": method,
    "stageVariables": {},
    "path": pathname
  };
}

function runApp(url, handlers, options, onEnd, onNext, method='GET', body) {
  const event = createEvent(url, method, body);
  modofun.aws(handlers, options)(event, {}, (err, resp) => onEnd && onEnd(resp));
}

function extractBody(response) {
  let data = response.body;
  if (data != null && data !== '') {
    data = JSON.parse(data);
  }
  if (data == null) {
    data = '';
  }
  return data;
}

describe('AWS Lambda type', function() {
  common.test(runApp, extractBody);

  describe('Automatic handler type recognition', function() {
    function testAutoType() {
      return function(done) {
        const event = createEvent('/test', 'POST');

        let lambdaEnvValue = null;
        if (process.env.LAMBDA_TASK_ROOT) {
          lambdaEnvValue = process.env.LAMBDA_TASK_ROOT;
        }
        process.env.LAMBDA_TASK_ROOT = '/var/task';

        modofun({
          test: (req) => {
            expect(req.method).to.equal('POST');
            done();
          }
        }, { mode: 'reqres', errorHandler: done })(event, {}, done);

        if (lambdaEnvValue) {
          process.env.LAMBDA_TASK_ROOT = lambdaEnvValue;
        }
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
