/*!
 * modfun
 * Copyright (c) 2017 Filipe Tavares
 * MIT License
 */

'use strict';

exports = module.exports = createServiceHandler;
exports.arity = arity;

/**
 * Errors issued by the service handler and passed on to error handler.
 * @private
 */
class ModfunError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * The exported function that creates the request handler
 * using the supplied handlers and configuration.
 *
 * Returns a handler with function(req, res, next) signature,
 * which is compatible with Express/Connect apps and middlewares,
 * and Google Cloud Functions.
 *
 * Example:
 *
 * var app = modfun(
 *   {
 *     authenticate: authenticate,
 *     user: [authorize, getUser]
 *   },
 *   {
 *     middleware: [logger],
 *     errorHandler: (err, req, res) => res.status(500).send(err.message)
 *   }
 * )
 * @public
 */
function createServiceHandler(handlers = {}, options = {}) {
  const errorHandler = options.errorHandler || defaultErrorHandler;
  const middlewares = options.middleware || (Array.isArray(options) ? options : []);
  const mode = options.mode || 'http';

  // return handler function with fn(req, res, next) signature
  return (req, res, next) => {
    // function to call when done
    const done = next || (err => err && errorHandler(err, req, res));
    // run global middleware first, then start handling request
    // this is important to allow loggers for example to kick-in regardless
    runMiddlewareStack(middlewares, req, res, (err) => {
      if (err) {
        done(err);
        return;
      }
      // try to apply supplied handlers to the requested operation
      handleRequest(handlers, mode, req, res, done);
    });
  };
}

/**
 * Try to apply supplied handlers to the requested operation.
 * @private
 */
function handleRequest(handlers, mode, req, res, done) {
  // get path if preprocessed or otherwise separate path from query string
  const path = req.path || req.url.split('?')[0];
  // fail if path is empty
  if (!path) {
    done(new ModfunError(403, 'NoOperation', 'Operation must be specified!'));
    return;
  }
  // parse path:
  // - first part is the operation name
  // - the following components of the path are used as arguments
  const parsedParts = path.substr(1).split('/');
  if (!parsedParts || parsedParts[0].length === 0) {
    done(new ModfunError(403, 'NoOperation', 'Operation must be specified!'));
    return;
  }
  const [operation, ...args] = parsedParts;

  if (operation && handlers.hasOwnProperty(operation)) {
    // the stack of operation specific middlewares
    let operationMiddlewares = [];
    // operation handler
    let operationHandler = handlers[operation];

    if (Array.isArray(operationHandler)) {
      // if an array is passed, add operation specific middlewares
      // last item in the array should be the operation handler
      operationMiddlewares = operationHandler.slice(0, -1);
      operationHandler = operationHandler[operationHandler.length-1];

    } else if (typeof operationHandler !== 'function') {
      // otherwise return internal error
      done(new ModfunError(500, 'InvalidConfig', 'Handler must be a function or array'));
      return;
    }

    // call middleware stack with same req/res context
    runMiddlewareStack(operationMiddlewares, req, res, (err) => {
      if (err) {
        done(err);
        return;
      }
      // call handler function
      if (mode === 'function') {
        invokeFunctionHandler(operationHandler, args, req, res, done);
      } else {
        invokeHTTPHandler(operationHandler, args, req, res, done);
      }
    });

  } else {
    // fail if requested operation cannot be resolved
    done(new ModfunError(404, 'NotFound', `No handler for: ${operation}`));
    return;
  }
}

/**
 * Run through the middleware stack in Connect/Express-like manner.
 * Heavily based on the Connect implementation: https://github.com/senchalabs/connect
 * @private
 */
function runMiddlewareStack(stack, req, res, callback) {
  let index = 0;
  // the middleware layer handover callback
  function next(err) {
    // get next middleware callback from stack
    const handle = stack[index++];
    // if no more layers in stack, invoke done callback and exit recursion
    if (!handle) {
      setImmediate(callback, err);
      return;
    }
    let error = err;
    // call the middleware handler
    try {
      if (err && handle.length === 4) {
        // there is an error and it's an error-handling middleware
        handle(err, req, res, next);
        return;
      } else if (!err && handle.length < 4) {
        // no error and it's a request-handling middleware
        handle(req, res, next);
        return;
      }
    } catch (e) {
      // if new error thrown, replace the error
      error = e;
    }
    // otherwise skip layer
    next(error);
  }
  // start going through middleware stack
  next();
}

/**
 * Invoke the provided request handler function.
 * This handler function must send a response.
 * If the handler returns a Promise,
 * the next() callback will be called after the promise is resolved
 * and will contain the error if the Promise is rejected.
 * @private
 */
function invokeHTTPHandler(handler, args, req, res, done) {
  // inject parsed parameters into request
  req.params = args;
  // call handler with typical HTTP request/response parameters
  let result = handler(req, res);
  // handle results that are not a trusted Promise with Promise.resolve()
  // which also supports other then-ables
  if (result instanceof Promise === false) {
    result = Promise.resolve(result);
  }
  return result.then(() => done()).catch(err => done(err));
}

/**
 * Invoke the provided request handler function.
 * The handler should return a value or a Promised value
 * which will be added to the reponse automatically.
 * @private
 */
function invokeFunctionHandler(handler, args, req, res, done) {
  // add to function arguments the remaining relevant input
  // could consider pushing the whole request object instead?
  // for now prefer to keep it to minimum to allow maximum flexibility
  args.push({
    body: req.body,
    query: req.query,
    user: req.user
  });
  // call handler function with
  let result = handler.apply(null, args);
  // handle results that are not a trusted Promise with Promise.resolve()
  // which also supports other then-ables
  if (result instanceof Promise === false) {
    result = Promise.resolve(result);
  }
  return result
    .then(value => {
      // check if response was sent already
      if (!res.headersSent) {
        // if not sent, send promise result as response
        if (value === null) {
          res.status(204).end();
        } else {
          res.status(200).json(value);
        }
      }
      done();
    })
    .catch(err => done(err));
}

/**
 * The default error handler, in case none is provided by the application.
 * @private
 */
function defaultErrorHandler(err, req, res) {
  if (err.name === 'UnauthorizedError') { // authentication is expected to be a common use-case
    res.status(401).send();
  } else {
    if (!err.status || err.status >= 500) {
      console.error(err.stack || err.toString());
    }
    res.status(err.status || 500).json({message: err.message})
  }
}

/**
 * Utility middleware to enforce an exact number of parameters.
 * @public
 */
function arity(amount) {
  return (req, res, next) => {
    const path = req.path || req.url.split('?')[0];
    const foundArity = (path.match(/[^/]\/[^/]/g) || []).length;
    if (foundArity === amount) {
      next();
    } else {
      next(new ModfunError(400, 'InvalidInput',
        `This operation requires exactly ${amount} parameters. Received ${foundArity}.`
      ));
    }
  }
}
