const modofun = require('../index');
const common = require('./common');

function runApp(path, handlers, options, onEnd, onNext) {
  const event = {
    "body": {},
    "resource": "/{proxy+}",
    "requestContext": {
      "resourceId": "123456",
      "apiId": "1234567890",
      "resourcePath": "/{proxy+}",
      "httpMethod": "GET",
      "requestId": "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
      "accountId": "123456789012",
      "identity": {
        "apiKey": null,
        "userArn": null,
        "cognitoAuthenticationType": null,
        "caller": null,
        "userAgent": "Custom User Agent String",
        "user": null,
        "cognitoIdentityPoolId": null,
        "cognitoIdentityId": null,
        "cognitoAuthenticationProvider": null,
        "sourceIp": "127.0.0.1",
        "accountId": null
      },
      "stage": "prod"
    },
    "queryStringParameters": {},
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
    "pathParameters": {
      "proxy": path
    },
    "httpMethod": "GET",
    "stageVariables": {
      "baz": "qux"
    },
    "path": path
  };
  options.type = 'aws';
  modofun(handlers, options)(event, {}, (err, resp) => onEnd && onEnd(resp));
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
