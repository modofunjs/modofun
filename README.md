# mod:o:fun :partly_sunny:

Moderate fun with **Modular Functions**: a fast no-dependencies **function router** for **serverless** applications.

[![Build Status](https://travis-ci.org/fptavares/modofun.svg?branch=master)](https://travis-ci.org/fptavares/modofun)
[![Coverage Status](https://coveralls.io/repos/github/fptavares/modofun/badge.svg?branch=master)](https://coveralls.io/github/fptavares/modofun?branch=master)
[![npm](https://img.shields.io/npm/v/modofun.svg)](https://www.npmjs.com/package/modofun)

```js
var modofun = require('modofun')

exports.service = modofun({
  hello: (name) => 'Hi ' + name, // /hello/John -> 200 OK 'Hi John'
  goodbye: () => 'See ya!'
})
```

[Features](#features) | [Quick Start](#quick-start) | [Platforms](#platforms)
 | [Configuration](#configuration) | [Specification](#specification) | [Installation](#installation)

## Why?

This is meant to be a very lightweight package to help build nano/micro-services for **serverless** platforms (Google Cloud Functions, AWS Lambda, etc). It aims to bridge the gap between too-small-single-function deployments, and more traditional Web/REST microservices. We want to group **functions** into **modules**.

Most of these serverless environments already provide a lot of facilities out of the box. And for these **nano-services**, we really shouldn't be bothered with complex HTTP parsing. We should leverage HTTP, but in a more **RPC** kind of way.

modofun is **_intentionally simplistic and small_**, and carries **no dependencies**. Which makes it a good choice for deploying small modules in serverless platforms.

## Features
  * Basic routing to functions
  * Parameter parsing
  * Automatic HTTP response building
  * Support for ES6 Promises (or any other then-able)
  * Connect/Express-like middleware support
  * **Google Cloud Functions**
  * **AWS Lambda** (with AWS API Gateway events)
  * Can also act as a middleware on Connect-based frameworks

For more complex features you might want to look at frameworks such as [Express](https://github.com/expressjs/express).

## Quick Start

A request is routed to a function based on the operation name, which is the first component of the application's path:

**/`{operation name}`/**`{param 0}`**/**`{param 1}`**/**`{param 2}`**/**`...`

The remaining components of the path are added as arguments to the function.

### Function Mode

This is the default mode. It makes it easy to expose an existing module as serverless cloud functions:

*user-module.js*
```js
async function get(username) { // async function with Promised return
  var user = await getFromDB(username)
  //...
  return user; // will respond 200 with user in JSON response body
}

function setNickname(username, nickname) {
  //...
  return; // will respond 204 with no response body
}
```

*index.js*
```js
var modofun = require('modofun')
var myModule = require('./user-module')

// function mode enables argument expansion and handling of returned values
exports.user = modofun(myModule, { mode: 'function' })
```

Handlers can return a Promise, which means you can also use async/await.

Additional request data, like the request body, headers and query string, is also
available in function mode as the `this` context when the handler function is called:

```js
function setPreferences(username) { // e.g. POST /setPreferences/andy?force=1
  var updatedValues = this.body;
  var forceUpdate = this.query.force;
  //...
}
```

For a complete list of fields available in the function context (this),
refer to [the handlers specification](#handlers).

An error response can be triggered by throwing an error, or returning a rejected Promise.
If the error has a `status` field, the default error handler will use it to set
the response status code accordingly. Otherwise it will respond with the `500` status code.

### Request/Response Mode

It also works with traditional request/response handlers like those expected by Google Cloud Functions and Express:

```js
var modofun = require('modofun')

var controller = {
  getUser = function(req, res) { // http://cloudfunction/myproject/getUser/[username]
    var [ username ] = req.params
    //...
    res.status(200).json(user)
  },
  //...
}

var app = modofun(controller, { mode: 'reqres' })
```

## Platforms

### Automatic Detection

You don't have to specify which platform your application will be deployed in.
If no `type` is specified, modofun will automatically detect which platform
it's running on by inspecting the environment variables set by the platform.

### Google Cloud Functions

Applications of type `gcloud` create an event handler for Google Cloud Functions,
but which also works with request/response frameworks like Express/Connect, etc.

You can force your application to return a handler of this type by setting the
type option:

```js
exports.handler = modofun(myModule, { type: 'gcloud' })
```

There is also a plugin to collect latency data (traces) from your application on Stackdriver: [modofun-trace-agent-plugin](https://github.com/fptavares/modofun-trace-agent-plugin).

### AWS Lambda

Applications of type `aws` creates a handler for AWS Lambda using API Gateway events.
You can force your application to return a handler of this type by setting the
type option:

```js
exports.handler = modofun(myModule, { type: 'aws' })
```

## Configuration

Enhance with middleware and custom error handlers:

```js
var modofun = require('modofun')
//...

exports.app = modofun(
  {
    authenticate: authenticate,
    user: [authorize, getUser] // auth middleware preceding specific operations
  },
  {
    middleware: [logger], // global middleware that runs every time
    errorHandler: (err, req, res) => res.status(500).send(err.message) // custom error handler
  }
)
```

The error handler takes care of catching both rejected promises and thrown Errors. There is a default error handler that should be sufficient for most cases.

### Middleware

Apply commonly used middleware:

```js
var modofun = require('modofun')
var morgan = require('morgan')
var cors = require('cors')
var jwt = require('express-jwt')
var controller = require('./service-controller')

exports.service = modofun(controller, [ morgan('tiny'), cors(), jwt(secret) ])
```

### Function Arity

When in `function` mode, all functions are automatically checked for the correct number of parameters according to the handler's function arity, but this behavior can be disabled through the `checkArity` option.

You can also enforce the correct number of input arguments for your functions by using the included arity checker middleware (e.g. in `reqres` mode, or when you want to selectively enforce arity checks per function):

```js
var modofun = require('modofun')
//...

const app = modofun(
  {
    authenticate: authenticate, // no arity validation, just needs to start with /authenticate/
    get: [modofun.arity(1), getUser], // /get/jdoe
    updatePIN: [authorize, modofun.arity(2), updatePIN] // /updatePIN/jdoe/9876
  }
)

exports.user = app
```

Which generates a 400 error if the request doesn't match the expected function arity.


## Specification

### API

#### modofun(handlers)
Creates an application with default options.
* `handlers`: An object with functions named after the operations to be exposed via the URL path. See the [handlers specification](#handlers) below.

#### modofun(handlers, middleware)
Creates an application with a list of global middleware to execute before the invoking the route handlers.
* `middleware`: An array of [Connect](https://github.com/senchalabs/connect)-style middleware.

#### modofun(handlers, options)
Create an application with an options object.
* `options`: An object with configuration options according to [this specification](#options).

#### modofun.arity(amount)
Enforces a specific amount of arguments for functions. Can be applied as an operation specific middleware, or even as a global middleware (if all your functions happen to have the same arity).
* `amount`: An integer number.

### Handlers

The object describing the operations to be exposed by the application. You can also specify operation specific middleware by passing an array instead of a function.

```js
{
  // Handler in reqres mode
  // req.params is filled with the path parameters (function arguments)
  // that follow the operation name.
  operationA: (req, res) => { res.send('Hello') },

  // Handler in function mode
  // Path parameters are passed as the function arguments
  // Additional request data is added to the function's context as the *this*
  // which contains the following properties:
  //  - this.method: string for the HTTP request method
  //  - this.headers: object with HTTP request headers
  //  - this.body: object with the parsed JSON body
  //  - this.query: object with the URL query parameters
  //  - this.user: object commonly used to store authenticated user information (e.g. Passport, JWT, etc)
  operationB: (param_0[, param_N]) => { return 'Hello' },

  // Operation with preceding middleware
  // The last element of the array should be the handler for the operation.
  // This works in both function and http modes.
  operationC: [...middleware, () => { /* Do stuff */ }]
}
```

### Options

Here is a list of the available options and their default values:

```js
{
  type, // possible values are: 'gcloud' and 'aws', otherwise auto detection kicks in
  mode: 'function', // possible values are: 'function' and 'reqres'
  middleware: [], // middleware is executed according to the order in the array
  checkArity: true, // possible values are: true and false
  errorHandler: modofun.defaultErrorHandler // function(error, request, response)
}

```

### AWS Request/Response Wrappers

modofun creates request and response wrappers for AWS, to be used by standard
Connect/Express middleware, and by handlers in `reqres` mode. However,
these are not complete request/response objects as you'd find in Express
or vanilla Node.js HTTP servers. They're limited to the most common data/methods
required for cloud functions, and that map best to AWS Lambda's event and
context. Here is an overview:

```js
Request = {
  method,
  path,
  query,
  headers,
  body,
  get: (name) => {},    // request header getter
  header: (name) => {}, // alias of get()
  // and extra for AWS:
  awsEvent,  // the original event object sent by AWS Lambda
  awsContext // the original context object sent by AWS Lambda
}

Response = {
  setHeader: (name, value) => {},
  status: (code) => {},
  send: (body) => {},
  json: (body) => {},
  end: () => {}
}
```

Note: Because of this, some middleware might not work properly when running in AWS Lambda.

## Installation

```bash
$ npm install modofun
```

Or

```bash
$ yarn add modofun
```
