function newFunction(value) {
  console.log('This is new and improved');
  console.log(`Value: ${value}`);
  return value * 2;
}

function anotherFunction() {
  return 'Hello world';
}

module.exports = { newFunction, anotherFunction };
