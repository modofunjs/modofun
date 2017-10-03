# mod:o:fun :partly_sunny:

Moderate fun with Modular Functions: a fast no-dependencies **function router** for **serverless** deployments.

[![Build Status](https://travis-ci.org/fptavares/modofun.svg?branch=master)](https://travis-ci.org/fptavares/modofun)
[![Coverage Status](https://coveralls.io/repos/github/fptavares/modofun/badge.svg?branch=master)](https://coveralls.io/github/fptavares/modofun?branch=master)
[![NPM Version](https://img.shields.io/npm/v/nyc.svg)](https://www.npmjs.com/package/modofun)

```js
var modofun = require('modofun')

var app = modofun({ hello: () => 'Hello World' })
```

## Why?

This is meant to be a very lightweight package to help build nano/micro-services for **serverless** environments (Google Cloud Functions, AWS Lambda, etc). It aims to bridge the gap between too-small-single-function deployments, and more traditional Web/REST microservices. We want to group **functions** into **modules**.

Most of these serverless environments already provide a lot of facilities out of the box. And for these **nano-services**, we really shouldn't be bothered with complex HTTP parsing. We should leverage HTTP, but in a more **RPC** kind of way.

modofun is **_intentionally simplistic and small_**, and carries no dependencies. Which makes it a good choice for deploying small modules in serverless environments.

## Features
  * Basic routing to functions
  * Parameter parsing
  * Automatic HTTP response building
  * Support for ES6 Promises and any other then-able
  * Connect/Express-like middleware support
  * Google Cloud Functions
  * [Future] AWS Lambda
  * Can act as a middleware on other Connect-based frameworks

For more complex features you might want to look at frameworks such as [Express](https://github.com/expressjs/express).

## Quick Start

A request is routed to a function based on the operation name, which is the first component of the application's path:

> **/`{operation name}`/**`{param 0}`**/**`{param 1}`**/**`{param 2}`**/**`...`

The remaining components of the path are added as arguments to the function.

### Request/Response

It works with traditional request/response handlers like those expected by Google Cloud Functions and Express:

```js
var modofun = require('modofun')

var controller = {
  getUser = function(req, res) { // http://cloudfunction/myproject/getUser/[username]
    var [ username ] = req.params
    //...
    res.status(200).json(user)
  }
}

var app = modofun(controller)
```

The error handler takes care of catching both rejected promises and thrown Errors. There is a default error handler that should be sufficient for most cases.

### Function Mode

Easy to expose an existing module to Google Cloud Functions:

*user-module.js*
```js
exports.get = async(username) => { // async function with Promised return
  var user = await getFromDB(username)
  //...
  return user; // will respond 200 with user in JSON response body
}
exports.setNickname = (username, nickname) => {
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

Note that handlers can return a Promise, which means you can also use async/await.

### Configuration

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

Enforce correct number of input arguments for your functions with the arity checker:

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
Which responds with a 400 error if the request doesn't match the expected function arity.


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
  // Handler in http mode
  // req.params is filled with the path parameters (function arguments)
  // that follow the operation name.
  operationA: (req, res) => { res.send('Hello') },

  // Handler in function mode
  // Path parameters are passed as the first function arguments
  // and followed by an object containing the following properties:
  //  - body: object with the parsed JSON body
  //  - query: object with the URL query parameters
  //  - user: object commonly used to store authenticated user information (e.g. Passport, JWT)
  operationB: (param_0[, param_N], requestData) => { return param.toUpperCase() },

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
  mode: 'http', // possible values are: 'function' and 'http'
  middleware: [], // middleware is executed according to the order in the array
  errorHandler: modofun.defaultErrorHandler // function(error, request, response)
}

```

## Installation

```bash
$ npm install modofun
```

Or

```bash
$ yarn add modofun
```
