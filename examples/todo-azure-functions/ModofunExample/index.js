const modofun = require('modofun');
const morgan = require('morgan');
const myModule = require('./myModule');

// export modofun handler so that the cloud serverless environment can use it
module.exports = modofun(myModule, [ morgan('tiny') ])
