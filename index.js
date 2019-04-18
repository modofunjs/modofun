/*!
 * modofun
 * Copyright (c) 2017 Filipe Tavares
 * MIT Licensed
 */

const http = require('http');
const url = require('url');

/* values for platform handler types */
const AWS_TYPE = 'aws'; // AWS API Gateway event
const AZURE_TYPE = 'azure'; // Azure Functions
const GCLOUD_TYPE = 'gcloud'; // Google Cloud, Express and others fn(req, res)
/* values for modes */
//    REQRES_MODE   = 'reqres';
const FUNCTION_MODE = 'function';

/*
 * Exports
 */
exports = module.exports = (h, o) => createServiceHandler(h, o);
exports.aws = (h, o) => createServiceHandler(h, o, AWS_TYPE);
exports.azure = (h, o) => createServiceHandler(h, o, AZURE_TYPE);
exports.gcloud = (h, o) => createServiceHandler(h, o, GCLOUD_TYPE);
exports.arity = arity;

/**
 * Errors issued by the service handler and passed on to error handler.
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
 * Abstract class for Request object wrapper.
 * @private
 */
class RequestWrapper {
  constructor(method, path, query, headers, body) {
    this.method = method;
    this.path = path;
    this.query = query || {};
    this.headers = {};
    // convert header names to lowercase
    Object.keys(headers || {}).forEach(h => this.headers[h.toLowerCase()] = headers[h]);
    // try to automatically parse request body if JSON
    if (body !== undefined && this.headers['content-type']
        && this.headers['content-type'].startsWith('application/json')) {
      try {
        this.body = body.length === 0 ? {} : JSON.parse(body);
      } catch(e) {
        this.body = body;
      }
    } else {
      this.body = body;
    }
  }
  get(name) {
    return this.headers[name.toLowerCase()];
  }
  header(name) {
    return this.get(name);
  }
}
/**
 * Request object wrapper for the AWS API Gateway event.
 * @private
 */
class AWSRequest extends RequestWrapper {
  constructor(event, context) {
    super(event.httpMethod, event.path, event.queryStringParameters,
      event.headers, event.body);
    this.awsEvent = event;
    this.awsContext = context;
  }
}
/**
 * Request object wrapper for the Azure HTTP request.
 * @private
 */
class AzureRequest extends RequestWrapper {
  constructor(req) {
    super(req.method, url.parse(req.originalUrl, false).pathname,
      req.query, req.headers, req.body);
    this.azureRequest = req;
  }
}

/**
 * Abstract class for Response object wrapper.
 * @private
 */
class ResponseWrapper extends http.ServerResponse {
  constructor(req) {
    super(req);
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  send(body) {
    this.end(body);
  }
  json(body) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(body));
  }
}
/**
 * Response object wrapper for the AWS API Gateway callback.
 * @private
 */
class AWSResponse extends ResponseWrapper {
  constructor(req, callback) {
    super(req);
    this._callback = callback;
  }
  end(body) {
    this._callback(null, {
      statusCode: this.statusCode,
      headers: this._headers, // TODO: switch to ServerResponse.getHeaders() once available on next LTS
      body: (body === undefined) ? '' : body // mimics Node.js OutgoingMessage behaviour of no response for undefined
    });
  }
}
/**
 * Response object wrapper for the Azure Response object.
 * @private
 */
class AzureResponse extends ResponseWrapper {
  constructor(req, context) {
    super(req);
    this._context = context;
  }
  end(body) {
    this._context.res = {
      status: this.statusCode,
      headers: this._headers, // TODO: switch to ServerResponse.getHeaders() once available on next LTS
      body: (body === undefined) ? '' : body // mimics Node.js OutgoingMessage behaviour of no response for undefined
    };
    this._context.done();
  }
}

/**
 * The exported function that creates the request handler
 * using the supplied handlers and configuration.
 *
 * Returns a handler with either function(req, res) signature
 * or function(event, context, callback) signature.
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
function createServiceHandler(handlers = {}, options = {}, shortcutType) {
  const errorHandler = options.errorHandler || defaultErrorHandler;
  const middleware = options.middleware || Array.isArray(options) && options || [];
  const mode = options.mode || FUNCTION_MODE;
  const checkArity = options.checkArity === undefined || Boolean(options.checkArity);
  const type = shortcutType || options.type || (process.env.LAMBDA_TASK_ROOT && AWS_TYPE)
    || (process.env.AzureWebJobsStorage && AZURE_TYPE) || GCLOUD_TYPE;

  if (type === AWS_TYPE) {
    // return handler function with fn(event, context, callback) signature
    return (event, context, callback) => {
      // if AWS Lambda request, convert event and context to request and response
      const req = new AWSRequest(event, context);
      const res = new AWSResponse(req, callback);
      // handle request
      handleRequest(middleware, handlers, mode, checkArity, req, res, errorHandler);
    };
  } else if (type === AZURE_TYPE) {
    // return handler function with fn(context) signature
    return (context) => {
      // if Azure request, convert context to request and response
      const req = new AzureRequest(context.req);
      const res = new AzureResponse(req, context);
      // handle request
      handleRequest(middleware, handlers, mode, checkArity, req, res, errorHandler);
    };
  } else if (type === GCLOUD_TYPE) {
    // return handler function with fn(req, res) signature
    return (req, res) => {
      // handle request
      handleRequest(middleware, handlers, mode, checkArity, req, res, errorHandler);
    };
  } else {
    throw new Error('Invalid type: ' + type)
  }
}

/**
 * Execute middleware stack and handle request.
 * @private
 */
function handleRequest(middleware, handlers, mode, checkArity, req, res, errorHandler) {
  const done = err => err && setImmediate(errorHandler, err, req, res);
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
 * it will handle the error if the Promise is rejected.
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
  // check if number of arguments provided matches the handler function arity
  if (checkArity && args.length < handler.length) { // < due to possible optionals
    done(new ModofunError(400, 'InvalidInput',
      `This operation requires ${handler.length} parameters. Received ${args.length}.`));
    return;
  }
  // set this in function call to the remaining relevant request data
  // could consider pushing the whole request object instead?
  // for now prefer to keep it to minimum to allow maximum flexibility
  const thisArg = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    user: req.user
  };
  // call handler function with
  let result = handler.apply(thisArg, args);
  // handle results that are not a trusted Promise with Promise.resolve()
  // which also supports other then-ables
  if (result instanceof Promise === false) {
    result = Promise.resolve(result);
  }
  return result
    .then(value => {
      if (value === null) {
        done(new ModofunError(404, 'NullResponse', `${req.path} resource was not found`));
        return;
      }
      if (value === undefined || value === '') {
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
  const path = req.path || (req.url && req.url.split('?')[0]) || '';
  // ignore start and end slashes, and split the path
  return path.replace(/^\/|\/$/g, '').split('/');
}

/**
 * Utility middleware to enforce a minimum number of parameters.
 * Accepts an extra argument for an optional maximum number.
 * @public
 */
function arity(min, max = Number.MAX_SAFE_INTEGER) {
  return (req, res, next) => {
    const foundArity = parsePath(req).length-1;
    if (foundArity < min ) {
      next(new ModofunError(400, 'InvalidInput',
        `This operation requires ${min} parameters. Received ${foundArity}.`));
    } else if (foundArity > max ) {
      next(new ModofunError(400, 'InvalidInput',
        `This operation doesn't accept more than ${max} parameters. Received ${foundArity}.`));
    } else {
      next();
    }
  }
}
