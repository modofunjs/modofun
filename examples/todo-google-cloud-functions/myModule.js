const uuidv4 = require('uuid/v4');

// mock data
const userDB = {
  'joe': [],
  'hannahb': []
};
const todoDB = {};
addTodoToDB('joe', 'Buy carrots');
addTodoToDB('joe', 'Get a haircut');

function addTodoToDB(username, text) {
  const id = uuidv4();
  todoDB[id] = text;
  userDB[username].push(id);
  return id;
}

/* /addTodo/{username}?todo={text} */
function addTodo(username) {
  const text = this.query.todo;
  if (!text) {
    throw new Error('Missing TODO text');
  }
  return addTodoToDB(username, text);
}

/* /getTodo/{id} */
function getTodo(id) {
  return todoDB[id] || null;
}

/* /getTodos/{username} */
function getTodos(username) {
  const todos = userDB[username].map(id => ({ id, text: todoDB[id] }));
  return todos;
}

/* /removeTodo/{username}/{id} */
function removeTodo(username, id) {
  const todoIndex = userDB[username].indexOf(id);
  if (todoIndex !== -1) {
    userDB[username].splice(todoIndex, 1);
  } else {
    return null;
  }
  delete todoDB[id];
}

module.exports = { addTodo, getTodo, getTodos, removeTodo }
