require('@google-cloud/trace-agent').start({
    plugins: { 'modofun': 'modofun-trace-agent-plugin' }
  });
require('@google-cloud/debug-agent').start();

const service = require('./service');

// export modofun handler so that the cloud serverless environment can use it
exports.myModofunExample = service
