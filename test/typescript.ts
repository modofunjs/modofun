import modofun = require('../index');

const handlers = {
  test1: (arg1, arg2) => {},
  test2: [ (req, res, next) => {}, () => {} ]
};

const app1 = modofun(handlers);

const app2 = modofun(handlers, [ (req, res, next) => {}, (one) => {} ]);

const app3 = modofun(handlers, {
  middleware: [ (req, res, next) => {}, (one) => {} ],
  checkArity: true,
  errorHandler: (error, req, res) => {},
  type: 'gcloud',
  mode: 'function'
});

app1();
app2('something');
app3({ test: 1 });
