function hello(name = 'world') {
  console.log(`Hello, ${name}!`);
  console.log('Welcome to Bonsai!');
}

function goodbye(name = 'world') {
  console.log(`Goodbye, ${name}!`);
}

function greet(name) {
  hello(name);
}

module.exports = { hello, goodbye, greet };
