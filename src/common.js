function arrayify(obj)
{
  if (Array.isArray(obj)){
    return obj;
  }else{
    return [obj];
  }
}

function flatten(iter)
{
  return [].concat(...iter);
}

function isIterable(obj)
{
  return (obj != null) && (obj[Symbol.iterator] != null);
}

module.exports = {
  arrayify,
  flatten,
  isIterable
}
