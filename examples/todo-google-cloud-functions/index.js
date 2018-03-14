require('@google-cloud/trace-agent').start({
    plugins: { 'modofun': 'modofun-trace-agent-plugin' }
  });
require('@google-cloud/debug-agent').start();

const modofun = require('modofun');
const morgan = require('morgan');
const myModule = require('./myModule');

// export modofun handler so that the cloud serverless environment can use it
exports.myModofunExample = modofun(myModule, [ morgan('tiny') ])
