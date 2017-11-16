var jsonwebtoken = require('jsonwebtoken');
var db = require('./database');

class MyError extends Error {
  constructor(code, message) {
    super(message);
    this.status = code;
  }
}

function authenticate() {
  const { credentials } = this.body;

  if (!credentials) {
    // send 400 error
    throw new MyError(400, 'Request did not provide credentials to authenticate');
  }

  /* should have authenticated here using e.g. DB, OAuth, etc */
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
  return {
    username,
    token
  };
}

function getUser(username) {
  const user = db.getUser(username);

  // respond to request
  return user;
}

function updatePIN(username, pin) {
  if (username !== this.user.username) { // user object injected by the JWT middleware
    throw new MyError(403, 'Unauthorized');
  }

  db.setPIN(username, pin);
}

module.exports = { authenticate, getUser, updatePIN }
