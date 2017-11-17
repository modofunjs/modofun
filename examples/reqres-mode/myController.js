var jsonwebtoken = require('jsonwebtoken');
var db = require('./database');

function authenticate(req, res) {
  const { credentials } = req.body;

  if (!credentials) {
    // send 400 error
    res.status(400).send('Request did not provide credentials to authenticate');
    return;
  }

  /* should have authenticated here using credentials */
  const username = 'joe'; // test user
  const user = db.getUser(username);

  const token = jsonwebtoken.sign(
    {
      username,
      pin: user.pin
    },
    process.env.JWT_SECRET || "A secret...", { expiresIn: '1h' }
  );

  // respond to request
  res.json({
    username,
    token
  });
}

function getUser(req, res) {
  const [ username ] = req.params;

  const user = db.getUser(username);

  // respond to request
  if (user) {
    res.json(user);
  } else {
    res.status(404).end();
  }
}

function updatePIN(req, res) {
  const [ username, pin ] = req.params;

  if (username !== req.user.username) { // user object injected by the JWT middleware
    res.status(403).send('Unauthorized');
    return;
  }

  db.setPIN(username, pin);

  // end request without a response body
  res.end();
}

module.exports = { authenticate, getUser, updatePIN }
