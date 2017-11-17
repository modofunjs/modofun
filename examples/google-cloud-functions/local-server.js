/* Use a local server for quick testing of the handler */
const express = require('express');
const service = require('./service');

const server = express();
// add the moddfun application handler as middleware
server.use(service);
// start local test server
server.listen(process.env.PORT || 3000, () => console.log(
  'You can test the handler on http://localhost:' + (process.env.PORT || 3000)
));
