# modfun

Moderate fun with Modular Functions: a light no-dependencies function router for cloud functions.

```js
var controller = {
  getUser = function() {
    ...
  }
}

var app = modfun(controller)
```

```
GET http://cloudfunction/project/getUser/[username]
```

Add middleware:

```js
var app = modfun(
  {
    authenticate: authenticate,
    user: [authorize, getUser]
  },
  {
    middleware: [logger],
    errorHandler: (err, req, res) => res.status(500).send(err.message)
  }
)
```

Easy to expose an existing module to Google Cloud Functions:

user-module.js
```js
exports.get = (username) => {
  ...
}
exports.giveProps = (username) => {
  ...
}
```

index.js
```js
var morgan = require('morgan')
var cors = require('cors')
var jwt = require('express-jwt')
var myModule = require('./user-module')

exports.user = modfun(myModule, [ morgan('tiny'), cors(), jwt(secret) ])
```

And apply commonly used middleware.

## Features
  * Basic routing to functions
  * Parameter parsing
  * Automatic HTTP reponse building
  * Connect/Express-like middleware support
  * Google Cloud Functions
  * [Future] AWS Lambda
  * Can itself be act as a middleware on other Connect-based frameworks

## Installation

```bash
$ npm install modfun
```

Or

```bash
$ yarn add modfun
```
