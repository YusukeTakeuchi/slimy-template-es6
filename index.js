const Ast = require("./src/ast");
const Parser = require("./src/parser");
const C = require("./src/common");

function slim(...args)
{
  return Parser.parse(...args).exec().getFirstNode();
}

function slimFrag(...args)
{
  return Parser.parse(...args).exec().getFragment();
}

function slimBind(...args)
{
  return Parser.parse(...args).exec().getBindings();
}

function slimEval(...args)
{
  return Parser.parse(...args).exec();
}

/**
 * @param {string|Array.<string>} names
 * @param {...object->object} f
 */
function referenceVariable(names, f=(x)=>x)
{
  return new Ast.Ref(C.arrayify(names), f);
}

module.exports = {
  slim, slimFrag, slimBind, slimEval,
  ref: referenceVariable,
};
