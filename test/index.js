const expect = require('chai').expect;
const http = require('http');
const httpMocks = require('node-mocks-http');
const modofun = require('../index');

console.error = function(){};

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

function runApp(operation, url, handler, done, options, extResponse) {
  const request = httpMocks.createRequest({ method: 'GET', url });
  const response = extResponse || httpMocks.createResponse();
  modofun({
    [operation]: handler,
    wrong1: () => done(new Error("Wrong one")),
  }, options)(request, response, done);
  return response;
}

function testRouting(config) {
  return function() {
    function checkCall(operation, path, valid=true) {
      return function(done) {
        runApp(operation, path, () => { valid && done() }, err => {
          if (err) {
            !valid && expect(err).to.be.an('error');
            done();
          }
        }, config);
      }
    }
    it('should pick the right route', checkCall('test', '/test/jdoe/1967'));
    it('should be case sensitive', checkCall('test', '/Test/jdoe/1967', false));
    it('should reject empty operation names', checkCall('', '//jdoe/1967', false));
    it('should reject empty paths', checkCall('test', '/', false));
  }
}

describe('HTTP mode', function() {

  describe('Routing', testRouting());

  describe('req.params', function() {
    function checkLength(path, length) {
      return function(done) {
        runApp('test', path, (req) => expect(req.params).to.have.lengthOf(length), done);
      }
    }
    it('should ignore a trailing slash', checkLength('/test/jdoe/1967/', 2));
    it('should support consecutive middle slashes', checkLength('/test/jdoe//1967/', 3));
    it('should support consecutive end slashes', checkLength('/test/jdoe/1967//', 3));
    it('should support consecutive slashes right after operation', checkLength('/test///jdoe/1967', 4));
    it('should support only consecutive slashes after operation', checkLength('/test//', 1));
    it('should support no params after operation', checkLength('/test', 0));
  });

  describe('Promises', function() {
    function checkDone(handler, shouldFail) {
      return function(done) {
        runApp('test', '/test', handler, (err) => {
          if (shouldFail) {
            expect(err).to.be.an('error');
          } else {
            expect(err).to.be.undefined;
          }
          done();
        });

      }
    }
    it('should trigger done() when resolved', checkDone(() => Promise.resolve('success')));
    it('should trigger done(err) when rejected', checkDone(() => Promise.reject(new Error('failure')), true));
  });

});


describe('Function mode', function() {

  describe('Routing', testRouting({ mode: 'function' }));

  describe('Function arguments', function() {
    function checkLength(path, length) {
      return function(done) {
        runApp('test', path, function() {
          expect(arguments).to.have.lengthOf(length+1); // +1 because of the request data object that is added to the end
        }, done, { mode: 'function' });
      }
    }
    it('should ignore a trailing slash', checkLength('/test/jdoe/1967/', 2));
    it('should support consecutive middle slashes', checkLength('/test/jdoe//1967/', 3));
    it('should support consecutive end slashes', checkLength('/test/jdoe/1967//', 3));
    it('should support consecutive slashes right after operation', checkLength('/test///jdoe/1967', 4));
    it('should support only consecutive slashes after operation', checkLength('/test//', 1));
    it('should support no params after operation', checkLength('/test', 0));
  });

  describe('Function return', function() {
    function checkResponse(value, expectedResponseData, expectedResponseStatus=200) {
      if (expectedResponseData === undefined) {
        expectedResponseData = value;
      }
      return function(done) {
        const response = httpMocks.createResponse();
        runApp('test', '/test', () => value, (err) => {
          err && done(err);

          let data = response._getData();
          if (value != null) {
            data = JSON.parse(data);
            expect(response._isJSON()).to.be.true;
          }
          expect(data).to.deep.equal(expectedResponseData);
          expect(response.statusCode).to.equal(expectedResponseStatus);
          expect(response._isEndCalled()).to.be.true;
          done();
        }, { mode: 'function' }, response);

      }
    }
    it('should support objects', checkResponse({ a: 1, b: 'haha', c: false }));
    it('should support arrays', checkResponse([1, 'haha', false]));
    it('should support strings', checkResponse('haha'));
    it('should support booleans', checkResponse(true));
    it('should support Promises', checkResponse(Promise.resolve('test'), 'test'));
    it('should support empty return', checkResponse(undefined, '', 204));
    it('should support null return', checkResponse(null, '', 204));
  });

});


describe('Default Error Handler', function() {
  function checkStatus(operation, path, handler, status) {
    return function(done) {
      const response = runApp(operation, path, handler, undefined, { mode: 'function' });
      setTimeout(() => {
        expect(response.statusCode).to.equal(status);
        expect(response._isEndCalled()).to.be.true;
        done();
      }, 50);
    }
  }
  function checkError(error, status) {
    return checkStatus('test', '/test', () => { throw error }, status);
  }

  const unauthorizedError = new Error();
  unauthorizedError.name = 'UnauthorizedError';
  it('should return 401 on authorization errors', checkError(unauthorizedError, 401));
  it('should return 500 for unknown errors', checkError(new Error('ksflksjd'), 500));
  it('should return 404 when handler not found', checkStatus('test', '/other', () => {}, 404));
  it('should return 500 on Promise rejection', checkStatus('test', '/test', () => Promise.reject('failed'), 500));
});


describe('modofun.arity()', function() {
  function testArity(path, length, valid=true) {
    const request = httpMocks.createRequest({ method: 'GET', url: path });
    const response = httpMocks.createResponse();
    const app = modofun({ test: [modofun.arity(length), () => {}] });

    return function(done) {
      app(request, response, err => {
        if (valid) {
          expect(err).to.be.undefined;
        } else {
          expect(err).to.be.an('error');
        }
        done();
      });
    }
  }
  it('should ignore a trailing slash', testArity('/test/jdoe/1967/', 2));
  it('should support consecutive middle slashes', testArity('/test/jdoe//1967/', 2, false));
  it('should support consecutive end slashes', testArity('/test/jdoe/1967//', 2, false));
  it('should support consecutive slashes right after operation', testArity('/test///jdoe/1967', 2, false));
  it('should support only consecutive slashes after operation', testArity('/test//', 2, false));
  it('should support no params after operation', testArity('/test', 0));
});


describe('Middleware Stack', function() {
  const mwIncr = function(req, res, next) {
    req.mwCounter++;
    next();
  }
  const mwHandleErr = function(err, req, res, next) {
    req.errCounter++;
    next();
  }
  const mwThrowError = (req, res, next) => { throw new Error('mw error') };
  const mwNextError = (req, res, next) => next(new Error('mw error'));

  function testStack(middleware, mwHits, errHits, handlerHits) {
    return function(done) {
      const request = httpMocks.createRequest({ method: 'GET', url: '/test' });
      request.mwCounter = 0;
      request.errCounter = 0;
      request.handlerCounter = 0;
      const response = httpMocks.createResponse();
      const app = modofun({ test: req => req.handlerCounter++ }, middleware);

      app(request, response, err => {
        expect(request.mwCounter).to.equal(mwHits);
        expect(request.errCounter).to.equal(errHits);
        expect(request.handlerCounter).to.equal(handlerHits);
        done();
      });
    }
  }
  it('should run through all middleware', testStack([mwIncr, mwIncr, mwIncr], 3, 0, 1));
  it('should stop after a thrown error', testStack([mwIncr, mwThrowError, mwIncr, mwIncr], 1, 0, 0));
  it('should stop after an error passed in next()', testStack([mwIncr, mwIncr, mwNextError, mwIncr], 2, 0, 0));
  it('should support error handling middleware', testStack([mwIncr, mwThrowError, mwIncr, mwHandleErr, mwIncr], 2, 1, 1));
});


describe('Bad config', function() {
  function testConfig(handlers, options, bad=true) {
    return function(done) {
      const request = httpMocks.createRequest({ method: 'GET', url: '/test' });
      const response = httpMocks.createResponse();
      modofun(handlers, options)(request, response, err => {
        bad && expect(err).to.be.an('error');
        done();
      });
    }
  }
  it('should fail if handlers is not an object', testConfig(1));
  it('should fail if handler is not a function', testConfig({ test: 'this is not a function' }));
  it('should fail if no handlers are provided', testConfig());
  it('should ignore improper middleware', testConfig({ test: () => {} }, ['this is not a middleware'], false));
});


describe('Vanilla HTTP IncomingMessage', function() {
  function testNoReqPath() {
    return function(done) {
      const request = new http.IncomingMessage();
      request.url = '/test';
      modofun({ test: () => done() })(request, null, err => err && done(err));
    }
  }
  it('should support not having req.path, only req.url', testNoReqPath());
});


describe('Shortcut methods for modes', function() {
  function testFunc(modeFunc, getParam) {
    return function(done) {
      const request = httpMocks.createRequest({ method: 'GET', url: '/test/paramTestValue' });
      const response = httpMocks.createResponse();
      modeFunc({
        test: (arg1) => expect(getParam(arg1)).to.equal('paramTestValue') && done()
      })(request, response, err => err && done(err));
    }
  }
  it('should support http mode', testFunc(modofun.http, req => req.params[0]));
  it('should support function mode', testFunc(modofun.function, param => param));
});
