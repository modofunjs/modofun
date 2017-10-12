const expect = require('chai').expect;
const modofun = require('../index');

exports.test = test;

console.error = function(){};

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

function test(runApp, extractBody) {

  function executeRequest(operation, url, handler, options, onEnd, onNext) {
    runApp(url, {
      [operation]: handler,
      wrong1: () => { throw new Error("Wrong one") },
    }, options, onEnd, onNext);
  }

  function testRouting(options={}) {
    return function() {
      function checkCall(operation, path, valid=true) {
        return function(done) {
          options.errorHandler = err => {
            !valid && expect(err).to.be.an('error');
            done();
          };
          executeRequest(operation, path, () => { valid && done() }, options);
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
          executeRequest('test', path,
            (req) => expect(req.params).to.have.lengthOf(length) && done(),
            { errorHandler: done });
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
      function checkDone(handler, valid=true) {
        return function(done) {
          executeRequest('test', '/test', handler,
            {
              errorHandler: err => {
                if (valid) {
                  done(err);
                } else {
                  expect(err).to.be.an('error');
                  done();
                }
              }
            });
        }
      }
      it('should trigger error handler when rejected', checkDone(() => Promise.reject(new Error('failure')), false));
    });

  });


  describe('Function mode', function() {

    describe('Routing', testRouting({ mode: 'function' }));

    describe('Function arguments', function() {
      function checkLength(path, length) {
        return function(done) {
          executeRequest('test', path, function() {
            expect(arguments).to.have.lengthOf(length+1); // +1 because of the request data object that is added to the end
            done();
          }, { mode: 'function', errorHandler: done });
        }
      }
      it('should ignore a trailing slash', checkLength('/test/jdoe/1967/', 2));
      it('should support consecutive middle slashes', checkLength('/test/jdoe//1967/', 3));
      it('should support consecutive end slashes', checkLength('/test/jdoe/1967//', 3));
      it('should support consecutive slashes right after operation', checkLength('/test///jdoe/1967', 4));
      it('should support only consecutive slashes after operation', checkLength('/test//', 1));
      it('should support no params after operation', checkLength('/test', 0));
    });

    describe('Function arity check', function() {
      function testArityCheck(path, valid=true) {
        return function(done) {
          executeRequest('test', path, (one, two) => valid && done(), {
            mode: 'function',
            checkArity: true,
            errorHandler: err => !valid && expect(err).to.be.an('error') && done()
          });
        }
      }
      it('should support path params only', testArityCheck('/test/jdoe/'));
      it('should support query string parameters', testArityCheck('/test/jdoe?a=1&bee=2'));
      it('should fail on missing path params', testArityCheck('/test?a=1&bee=2', false));
      it('should fail on too many path parameters', testArityCheck('/test/jdoe/too/many', false));
    });

    describe('Function return', function() {
      function checkResponse(value, expectedResponseData, expectedResponseStatus=200) {
        if (expectedResponseData === undefined) {
          expectedResponseData = value;
        }
        return function(done) {
          executeRequest('test', '/test', () => value,
            { mode: 'function', errorHandler: done },
            response => {
              expect(extractBody(response)).to.deep.equal(expectedResponseData);
              expect(response.statusCode).to.equal(expectedResponseStatus);
              done();
            }
          );
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
        executeRequest(operation, path, handler,
          { mode: 'function' },
          (response) => {
            expect(response.statusCode).to.equal(status);
            done();
          });
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
      return function(done) {
        executeRequest('test', path, [modofun.arity(length), () => valid && done()], {
          errorHandler: err => {
            if (valid) {
              done(err);
            } else {
              expect(err).to.be.an('error');
              done();
            }
          }
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
      if (!res.mwCounter) {
        res.mwCounter = 0;
      }
      res.mwCounter++;
      next();
    }
    const mwHandleErr = function(err, req, res, next) {
      if (!res.errCounter) {
        res.errCounter = 0;
      }
      res.errCounter++;
      next();
    }
    const mwThrowError = (req, res, next) => { throw new Error('mw error') };
    const mwNextError = (req, res, next) => next(new Error('mw error'));

    function testStack(middleware, mwHits, errHits, handlerHits) {
      return function(done) {
        executeRequest('test', '/test',
          (req, res) => {
            res.handlerCounter = 1;
            res.end();
          },
          middleware,
          res => {
            expect(res.mwCounter || 0).to.equal(mwHits);
            expect(res.errCounter || 0).to.equal(errHits);
            expect(res.handlerCounter || 0).to.equal(handlerHits);
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
    function testConfig(handlers, middleware, bad=true) {
      return function(done) {
        runApp('/test', handlers, { middleware, mode: 'function' }, resp => {
          if (bad) {
            expect(resp.statusCode).to.be.at.least(400);
          } else {
            expect(resp.statusCode).to.be.below(300);
          }
          done();
        });
      }
    }
    it('should fail if handlers is not an object', testConfig(1));
    it('should fail if handler is not a function', testConfig({ test: 'this is not a function' }));
    it('should fail if no handlers are provided', testConfig());
    it('should ignore improper middleware', testConfig({ test: () => {} }, ['this is not a middleware'], false));
  });
}


/*describe('Shortcut methods for modes', function() {
  function testFunc(modeFunc, getParam) {
    return function(done) {
      const request = httpMocks.createRequest({ method: 'GET', url: '/test/paramTestValue' });
      const response = httpMocks.createResponse();
      modeFunc({
        test: (arg1) => {
          expect(getParam(arg1)).to.equal('paramTestValue');
          done();
        }
      }, [])(request, response, err => err && done(err));
    }
  }
  it('should support function mode', testFunc(modofun.function, param => param));
});*/
