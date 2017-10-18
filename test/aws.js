const url = require('url');
const modofun = require('../index');
const common = require('./common');

function createEvent(requestUrl, method, body) {
  const { pathname, query } = url.parse(requestUrl, true);
  return {
    "body": body,
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
      "Accept-Encoding": "gzip, deflate, sdch"
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
});
