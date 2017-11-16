var modofun = require('modofun');
var morgan = require('morgan');
var jwt = require('express-jwt');
var controller = require('./myController');

const authorize = jwt({ secret: process.env.JWT_SECRET || "A secret..." });
const logger = morgan('tiny');

const handler = modofun(
  {
    authenticate: controller.authenticate,
    user: [authorize, modofun.arity(1), controller.getUser],
    update: [authorize, modofun.arity(2), controller.updatePIN]
  },
  {
    mode: 'reqres',
    middleware: [logger]
  }
);

// export modofun handler so that the cloud serverless environment can use it
exports.myService = handler
