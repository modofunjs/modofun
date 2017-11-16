var modofun = require('modofun');
var morgan = require('morgan');
var jwt = require('express-jwt');
var myModule = require('./myModule');

const authorize = jwt({ secret: process.env.JWT_SECRET || "A secret..." });

// export modofun handler so that the cloud serverless environment can use it
exports.myService = modofun(
  {
    authenticate: myModule.authenticate,
    user: [authorize, myModule.getUser],
    update: [authorize, myModule.updatePIN]
  },
  [ morgan('tiny') ]
);
