function newFunction(value) {
  const x = value || 1;
  const y = x * 2;
  return x + y;
}

function helper() {
  return 'unchanged';
}

function addedFunction() {
  console.log('This is new');
  return true;
}
