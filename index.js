/*!
 * modofun
 * Copyright (c) 2017 Filipe Tavares
 * MIT Licensed
 */

const http = require('http');

exports = module.exports = createServiceHandler;

exports.aws = createAwsServiceHandler;
exports.arity = arity;

/**
 * Errors issued by the service handler and passed on to error handler, or next().
 * @private
 */
class ModofunError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Request object wrapper for the AWS API Gateway event.
 * @private
 */
class AWSRequest {
  constructor(event, context) {
    this.event = event;
    this.context = context;
    this.method = event.httpMethod;
    this.path = event.path;
    this.query = event.queryStringParameters;
    this.body = event.body;
    this.headers = event.headers;
  }
}

/**
 * Response object wrapper for the AWS API Gateway callback.
 * @private
 */
class AWSResponse extends http.ServerResponse {
  constructor(req, callback) {
    super(req);
    this._callback = callback;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  json(body) {
    this.setHeader('Content-Type', 'application/json');
    this._callback(null, {
      statusCode: this.statusCode,
      headers: this._headers, // TODO: use ServerResponse.getHeaders() once available on next LTS
      body: JSON.stringify(body)
    });
  }
  end(body) {
    this._callback(null, { statusCode: this.statusCode, headers: this._headers, body });
  }
}

/*
 * Service handler type
 */
const AWS_TYPE = 'aws'; // AWS API Gateway event
const REQRES_TYPE = 'reqres'; // Google Cloud, Express and others fn(req, res[, next])
/*
 * Route handler mode
 */
const HTTP_MODE = 'http';
const FUNCTION_MODE = 'function';

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
 * var app = modofun(
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
  const middleware = options.middleware || Array.isArray(options) && options || [];
  const mode = options.mode || HTTP_MODE;
  const type = options.type || REQRES_TYPE;
  const checkArity = Boolean(options.checkArity);

  if (type === AWS_TYPE) {
    // return handler function with fn(event, context, callback) signature
    return (event, context, callback) => {
      // if AWS Lambda request, convert event and context to request and response
      const req = new AWSRequest(event, context);
      const res = new AWSResponse(req, callback);
      // function to call when done
      const done = err => err && setImmediate(errorHandler, err, req, res);
      // handle request
      handleRequest(middleware, handlers, mode, checkArity, req, res, done);
    };
  } else {
    // return handler function with fn(req, res, next) signature
    return (req, res, next) => {
      // function to call when done
      const done = next && (err => setImmediate(next, err))
                   || (err => err && setImmediate(errorHandler, err, req, res));
      // handle request
      handleRequest(middleware, handlers, mode, checkArity, req, res, done);
    };
  }
}

/**
 * Execute middleware stack and handle request.
 * @private
 */
function handleRequest(middleware, handlers, mode, checkArity, req, res, done) {
  // run global middleware first, then start handling request
  // this is important to allow loggers for example to kick-in regardless
  runMiddlewareStack(middleware, req, res, (err) => {
    if (err) {
      done(err);
      return;
    }
    // try to apply supplied handlers to the requested operation
    handleOperation(handlers, mode, checkArity, req, res, done);
  });
}

/**
 * Try to apply supplied handlers to the requested operation.
 * @private
 */
function handleOperation(handlers, mode, checkArity, req, res, done) {
  // parse path:
  // - first part is the operation name
  // - the following components of the path are used as arguments
  const parsedParts = parsePath(req);
  if (parsedParts[0].length === 0) {
    done(new ModofunError(403, 'NoOperation', 'Operation must be specified!'));
    return;
  }
  const [operation, ...args] = parsedParts;

  if (operation && handlers.hasOwnProperty(operation)) {
    // the stack of operation specific middleware
    let operationMiddleware = [];
    // operation handler
    let operationHandler = handlers[operation];

    if (Array.isArray(operationHandler)) {
      // if an array is passed, add operation specific middleware
      // last item in the array should be the operation handler
      operationMiddleware = operationHandler.slice(0, -1);
      operationHandler = operationHandler[operationHandler.length-1];

    } else if (typeof operationHandler !== 'function') {
      // otherwise return internal error
      done(new ModofunError(500, 'InvalidConfig', 'Handler must be a function or array'));
      return;
    }

    // call middleware stack with same req/res context
    runMiddlewareStack(operationMiddleware, req, res, (err) => {
      if (err) {
        done(err);
        return;
      }
      try {
        // call handler function
        if (mode === FUNCTION_MODE) {
          invokeFunctionHandler(operationHandler, args, checkArity, req, res, done);
        } else {
          invokeHTTPHandler(operationHandler, args, req, res, done);
        }
      } catch(err) {
        done(err);
      }
    });

  } else {
    // fail if requested operation cannot be resolved
    done(new ModofunError(404, 'NotFound', `No handler for: ${operation}`));
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
      callback(err);
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
  return result.then(() => done()).catch(done);
}

/**
 * Invoke the provided request handler function.
 * The handler should return a value or a Promised value
 * which will be added to the reponse automatically.
 * @private
 */
function invokeFunctionHandler(handler, args, checkArity, req, res, done) {
  // add to function arguments the remaining relevant input
  // could consider pushing the whole request object instead?
  // for now prefer to keep it to minimum to allow maximum flexibility
  args.push({
    body: req.body,
    query: req.query,
    user: req.user
  });
  // check if number of arguments provided matches the handler function arity
  if (checkArity && handler.length !== args.length) {
    done(new ModofunError(400, 'InvalidInput',
      `This operation requires ${handler.length} parameters. Received ${args.length}.`
    ));
    return;
  }
  // call handler function with
  let result = handler.apply(null, args);
  // handle results that are not a trusted Promise with Promise.resolve()
  // which also supports other then-ables
  if (result instanceof Promise === false) {
    result = Promise.resolve(result);
  }
  return result
    .then(value => {
      if (value == null) {
        res.status(204).end();
      } else {
        res.status(200).json(value);
      }
      done();
    })
    .catch(done);
}

/**
 * The default error handler, in case none is provided by the application.
 * @private
 */
function defaultErrorHandler(err, req, res) {
  if (err.name === 'UnauthorizedError') { // authentication is expected to be a common use-case
    res.status(401).end();
  } else {
    if (!err.status || err.status >= 500) {
      console.error(err.stack || err.toString());
    }
    res.status(err.status || 500).json({message: err.message})
  }
}

/**
 * Parse URL path to an array of its components.
 * @private
 */
function parsePath(req) {
  // get path if preprocessed or otherwise separate path from query string
  const path = req.path || req.url && req.url.split('?')[0];
  // ignore start and end slashes, and split the path
  return path.replace(/^\/|\/$/g, '').split('/');
}

/**
 * Utility middleware to enforce an exact number of parameters.
 * @public
 */
function arity(amount) {
  return (req, res, next) => {
    const foundArity = parsePath(req).length-1;
    if (foundArity === amount) {
      next();
    } else {
      next(new ModofunError(400, 'InvalidInput',
        `This operation requires exactly ${amount} parameters. Received ${foundArity}.`
      ));
    }
  }
}

/**
 * Shortcut method to create an application for AWS Lambda with API Gateway events (type='aws').
 * @public
 */
function createAwsServiceHandler(handlers, options) {
  const optionsObj = Array.isArray(options) ? { middleware: options } : options;
  optionsObj.type = AWS_TYPE;
  return createServiceHandler(handlers, optionsObj);
}
