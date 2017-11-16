/*
 * Use a local server for quick testing of the handler
 */
var express = require('express');
var bodyParser = require('body-parser');

var app = require('./index');

const server = express();
// request body parsers
server.use(bodyParser.urlencoded({ extended: false }));
server.use(bodyParser.json());
// add the moddfun application handler as middleware
server.use((req, res) => app.myService(req, res));
// start local test server
server.listen(process.env.PORT || 3000, () => console.log(
  'You can test the handler on http://localhost:' + (process.env.PORT || 3000)
));
