# mod:cloud:fun

Moderate fun with Modular Functions: a fast no-dependencies **function router** for **serverless** deployments.

```js
var modfun = require('modfun')

var app = modfun({ hello: () => 'Hello World' })
```

## Why?

This is meant to be a very lightweight package to use when building nano/micro-services using **serverless** environments (Google Cloud Functions, AWS Lambda, etc). It aims to bridge the gap between too small single function deployments, and more traditional Web/REST microservices. We want to group **functions** into **modules**.

Most of these serverless environments already provide a lot of facilities out of the box. And for these **nano-services**, we really shouldn't be bothered with complex HTTP parsing. We should leverage HTTP, but in a more **RPC** kind of way.

modfun is **_intentionally simplistic and small_**, and carries no dependencies. Which makes it a good choice for deployment small modules in serverless environments.

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

Works with traditional request/response handlers like those expected by Google Cloud Functions and Express:

```js
var modfun = require('modfun')

var controller = {
  getUser = function(req, res) {
    var [ username ] = req.params
    ...
    res.status(200).json(user)
  }
}

var app = modfun(controller)
```

```
GET http://cloudfunction/myproject/getUser/[username]
```

Enhance with middleware and custom error handlers:

```js
var modfun = require('modfun')
...

exports.app = modfun(
  {
    authenticate: authenticate,
    user: [authorize, getUser] // middleware preceding operation
  },
  {
    middleware: [logger], // global middleware that runs every time
    errorHandler: (err, req, res) => res.status(500).send(err.message) // custom error handler
  }
)
```

The error handler takes care of catching both rejected promises and thrown Errors. There is a default error handler that should be sufficient for most cases.

Easy to expose an existing module to Google Cloud Functions:

*user-module.js*
```js
exports.get = async(username) => {
  var user = await getFromDB(username)
  ...
  return user; // will respond 200 with user in JSON response body
}
exports.setNickname = (username, nickname) => {
  ...
  return; // will respond with 204 with no response body
}
```

*index.js*
```js
var modfun = require('modfun')
var myModule = require('./user-module')

exports.user = modfun(myModule, { mode: 'function' })
```

Note that functions can return a Promise, which means you can also use async/await.

Apply commonly used middleware:

```js
var modfun = require('modfun')
var morgan = require('morgan')
var cors = require('cors')
var jwt = require('express-jwt')
var controller = require('./service-controller')

exports.service = modfun(controller, [ morgan('tiny'), cors(), jwt(secret) ])
```

Enforce correct number of input arguments for your functions with the arity checker:

```js
var modfun = require('modfun')

const app = modfun(
  {
    authenticate: authenticate, // /authenticate
    user: [authorize, modfun.arity(1), getUser], // /user/jdoe
    updatePIN: [authorize, modfun.arity(2), updatePIN] // /updatePIN/jdoe/9876
  }
);
```
Which responds with a 400 error if the request doesn't match the expected function arity.

## Installation

```bash
$ npm install modfun
```

Or

```bash
$ yarn add modfun
```
