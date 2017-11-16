// Mock user data
const usersById = {
  'joe': {
    name: 'John Doe',
    pin: 1234
  },
  'hannahb': {
    name: 'Hannah Banana',
    pin: 9876
  }
};

function getUser(username) {
  return usersById[username] || null;
}

function setPIN(username, pin) {
  usersById[username].pin = pin;
}

module.exports = { getUser, setPIN }
