const modofun = require('modofun');
const morgan = require('morgan');
const myModule = require('./myModule');

module.exports = modofun(myModule, [ morgan('tiny') ])
