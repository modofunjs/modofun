[Features](#features) \| [Quick Start](#quick-start) \| [Platforms](#platforms) \| [Configuration](#configuration) \| [Specification](#specification) \| [Installation](#installation) \| **[Examples](examples/)**

# <a href='http://modofun.js.org'><img src='https://raw.githubusercontent.com/modofunjs/modofun/master/assets/images/modofun-logo-wide.png' alt='modofun' width='275' /></a>

Moderate fun with **Modular Functions**: a fast **function router** for **serverless** Node.js applications

```js
var modofun = require('modofun')

exports.service = modofun({
  hello: (name) => 'Hi ' + name, // http://.../hello/John -> 200 OK 'Hi John'
  goodbye: () => 'See ya!'
})
```

[![Build Status](https://travis-ci.org/modofunjs/modofun.svg?branch=master)](https://travis-ci.org/modofunjs/modofun)
[![Coverage Status](https://coveralls.io/repos/github/modofunjs/modofun/badge.svg?branch=master)](https://coveralls.io/github/modofunjs/modofun?branch=master)
[![npm](https://img.shields.io/npm/v/modofun.svg)](https://www.npmjs.com/package/modofun)

# Why?

Modofun is a very lightweight [Node.js](https://nodejs.org) package to help build nano/micro-services for **serverless** platforms (Google Cloud Functions, AWS Lambda, and Azure Functions). It aims to bridge the gap between too-small-single-function deployments, and more traditional Web/REST microservices. We want to group functions into **modules**.

Most serverless environments already provide a lot of facilities out of the box. And for these **nanoservices**, we really shouldn't be bothered with complex HTTP parsing. We should leverage HTTP, but in a more RPC kind of way.

Modofun is **intentionally simplistic and small**, and carries **no dependencies**. Which makes it a good choice for deploying small modules in serverless platforms.

# Features
  * Routing to multiple functions
  * Parameter parsing
  * Automatic HTTP response building
  * Express/Connect middleware support
  * Multi-cloud:
    * **Google Cloud Functions**
    * **AWS Lambda** (with AWS API Gateway events)
    * **Azure Functions**
  * Support for ES6 Promises (or any other then-able)
  * Automatic error handling

# Quick Start

A request is routed to a function based on the operation name, which is the first component of the application's path:

<img src="https://raw.githubusercontent.com/modofunjs/modofun/master/assets/images/modofun-routing.png" alt="https://[cloud-baseurl]/{operation}/{param0}/{param1}/.../" width="604" />

The remaining components of the path are added as arguments to the function.

## Function Mode

This is the default mode. It makes it easy to expose an existing module as serverless cloud functions:

*index.js*
```js
var modofun = require('modofun')
var myModule = require('./user-module')

// function mode enables argument expansion and handling of returned values
exports.user = modofun(myModule, { mode: 'function' })
```

*user-module.js*
```js
async function get(username) { // async function with Promised return
  var user = await getFromDB(username)
  //...
  return user; // will respond 200 OK with JSON response body, or 404 Not Found if null
}
function setNickname(username, nickname) {
  //...
  return; // will respond 204 with no response body
}
```

Handlers can return a Promise, which means you can also use async/await.

Additional request data, like the request body, headers and query string, is also
available in function mode as the `this` context when the handler function is called:

```js
function update(username) { // e.g. POST /update/andy?force=1
  var updatedValues = this.body;
  var forceUpdate = this.query.force;
  //...
}
```

The [complete list of fields](#request-data-in-function-mode) available in the function context (`this`) can be found in [the handlers specification](#handlers).

An error response can be triggered by throwing an error, or returning a rejected Promise.
If the error has a `status` field, the default error handler will use it to set
the response status code accordingly. Otherwise it will respond with the `500` status code.

## Request/Response Mode

It also works with traditional request/response handlers like those expected by Google Cloud Functions and Express:

```js
var modofun = require('modofun')

var controller = {
  getUser: function(req, res) { // e.g. .../getUser/joe1976
    var [ username ] = req.params
    //...
    res.status(200).json(user)
  },
  //...
}

var app = modofun(controller, { mode: 'reqres' })
```

# Platforms

<img src="https://raw.githubusercontent.com/modofunjs/modofun/master/assets/images/modofun-platforms.png" alt="" width="487" />

## Automatic Detection

You don't have to specify which platform your application will be deployed in.
If no `type` is specified, modofun will automatically detect which platform
it's running on by inspecting the environment variables set by the platform.

## Google Cloud Functions

Applications of type `gcloud` create an event handler for Google Cloud Functions,
but which also works with request/response frameworks like Express/Connect, etc.

You can force your application to return a handler of this type by setting the
type option:

```js
exports.handler = modofun(myModule, { type: 'gcloud' })
```

There is also a plugin to collect latency data (traces) from your application on Stackdriver: [modofun-trace-agent-plugin](https://github.com/modofunjs/modofun-trace-agent-plugin).

## AWS Lambda

Applications of type `aws` create a handler for AWS Lambda using API Gateway events.
You can force your application to return a handler of this type by setting the
type option:

```js
exports.handler = modofun(myModule, { type: 'aws' })
```

## Azure Functions

Applications of type `azure` create a handler for Azure Functions using an HTTP trigger.
You can force your application to return a handler of this type by setting the
type option:

```js
exports.handler = modofun(myModule, { type: 'azure' })
```

# Configuration

Enhance with middleware and custom error handlers:

```js
var modofun = require('modofun')
//...

exports.app = modofun(
  {
    authenticate: authenticate,
    user: [ authorize, getUser ] // auth middleware preceding specific operations
  },
  {
    middleware: [ logger ], // global middleware that runs every time
    errorHandler: (err, req, res) => res.status(500).send(err.message) // custom error handler
  }
)
```

The error handler takes care of catching both rejected promises and thrown Errors. There is a default error handler that should be sufficient for most cases.

## Middleware

Apply commonly used middleware:

```js
var modofun = require('modofun')
var morgan = require('morgan')
var cors = require('cors')
var jwt = require('express-jwt')
var controller = require('./service-controller')

exports.service = modofun(controller, [ morgan('tiny'), cors(), jwt(secret) ])
```

## Function Arity

When in `function` mode, all functions are automatically checked for the correct number of parameters according to the handler's function arity, but this behavior can be disabled through the `checkArity` option.

You can also enforce the correct number of input arguments for your functions by using the included arity checker middleware (e.g. in `reqres` mode, or when you want to selectively enforce arity checks per function):

```js
var modofun = require('modofun')
//...

const app = modofun(
  {
    authenticate: authenticate, // no arity validation, just needs to start with /authenticate/
    get: [ modofun.arity(1), getUser ], // /get/jdoe
    updatePIN: [ authorize, modofun.arity(2), updatePIN ] // /updatePIN/jdoe/9876
  }
)

exports.user = app
```

Which generates a 400 error if the request doesn't match the expected function arity.

Note that, in Javascript, a function's arity is only counted up to the first optional argument (i.e. the first argument with a default value). As an example of this, the following function is considered to have an arity of 2:

```js
function foo(one, two, three='optional', four) {
  //...
}
```


# Specification

## API

#### modofun(handlers)
Creates an application with default options.
* `handlers`: An object with functions named after the operations to be exposed via the URL path. See the [handlers specification](#handlers) below.

#### modofun(handlers, middleware)
Creates an application with a list of global middleware to execute before the invoking the route handlers.
* `middleware`: An array of [Connect](https://github.com/senchalabs/connect)-style middleware.

#### modofun(handlers, options)
Create an application with an options object.
* `options`: An object with configuration options according to the [options specification](#options).

#### modofun.arity(minimum)
Enforces a minimum amount of arguments for functions. Can be applied as an operation specific middleware, or even as a global middleware (if all your functions happen to have the same arity).
* `minimum`: An integer number.

#### modofun.arity(minimum, maximum)
Same as above, except that the additional `maximum` adds an upper limit for the allowed amount of arguments for functions.
* `minimum`: An integer number.
* `maximum`: An integer number.

## Handlers

The object describing the operations to be exposed by the application. You can also specify operation specific middleware by passing an array instead of a function.

```js
{
  // Handler in function mode
  // Path parameters are passed as the function arguments.
  // Additional request data is added to the function's context as the *this*.
  operationA: (param_0[, param_N]) => { return 'Hello' },

  // Handler in reqres mode
  // req.params is filled with the path parameters (function arguments)
  // that follow the operation name.
  operationB: (req, res) => { res.send('Hello') },

  // Operation with preceding middleware
  // The last element of the array should be the handler for the operation.
  // This works in both function and http modes.
  operationC: [ ...middleware, () => { /* Do stuff */ } ]
}
```

### Request Data in Function Mode

Handlers in function mode can find additional request data in the function's context (*this*), which contains the following properties:
* `this.method`: string for the HTTP request method
* `this.headers`: object with HTTP request headers
* `this.body`: object with the parsed JSON body
* `this.query`: object with the URL query parameters
* `this.user`: object commonly used to store authenticated user information (e.g. Passport, JWT, etc)

## Options

Here is a list of the available options and their default values:

```js
{
  type, // possible values are: 'gcloud', 'aws' or 'azure', otherwise auto detection kicks in
  mode: 'function', // possible values are: 'function' or 'reqres'
  middleware: [], // middleware is executed according to the order in the array
  checkArity: true, // possible values are: true and false
  errorHandler: modofun.defaultErrorHandler // function(error, request, response)
}

```

## AWS and Azure Request/Response Wrappers

Modofun creates request and response wrappers for AWS and Azure, to be used by standard
Connect/Express middleware, and by handlers in `reqres` mode. However,
these are not complete request/response objects as you'd find in Express
or vanilla Node.js HTTP servers. They're limited to the most common data/methods
required for cloud functions, and that map best to AWS and Azure events. Here is an overview:

```js
Request = {
  method,
  path,
  query,
  headers,
  body,
  get: (name) => {},    // request header getter
  header: (name) => {}, // alias of get()
  // extra only for AWS:
  awsEvent,  // the original event object sent by AWS Lambda
  awsContext, // the original context object sent by AWS Lambda
  // and extra only for Azure:
  azureRequest // the original request object sent by Azure
}

Response = {
  setHeader: (name, value) => {},
  status: (code) => {},
  send: (body) => {},
  json: (body) => {},
  end: () => {}
}
```

Note: Because of this, some middleware may not work properly when running in AWS Lambda or Azure. If you find middleware that you'd like to use, but that is not compatible with Modofun, please [report it](https://github.com/modofunjs/modofun/issues/new) on GitHub.

# Installation

You can install it using [npm](https://www.npmjs.com):

```bash
$ npm install modofun
```

Or [yarn](https://yarnpkg.com):

```bash
$ yarn add modofun
```

# Examples

The best way to start is to look through [the examples](examples/).
