// Greeting utilities
function hello(name = 'world') {
  const message = `Hello, ${name}!`;
  console.log(message);
  console.log('Welcome to Bonsai - your beautiful git diff viewer!');
  return message;
}

function goodbye(name = 'world') {
  const message = `Goodbye, ${name}! See you soon!`;
  console.log(message);
  return message;
}

function greet(name) {
  hello(name);
  console.log('Hope you are having a great day!');
}

function wave() {
  console.log('👋');
}

module.exports = { hello, goodbye, greet, wave };
