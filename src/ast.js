C = require("./common");

/** Represents a node of parse tree.
 * Note that this is different from DOM Node.
 */

class EvaluateContext{
  constructor(options)
  {
    this.options = options;
    this.bindings = new Map; // @name
    this.variables = new Map; // for x of
  }

  addBinding(name, value)
  {
    if (!this.bindings.has(name)){
      this.bindings.set(name, []);
    }
    this.bindings.get(name).push(value);
    return this;
  }

  letVariableIn(name, value, f)
  {
    const originalValue = this.variables.get(name);
    try{
      this.variables.set(name, value);
      return f();
    }finally{
      this.variables.set(name, originalValue);
    }
  }

  getVariable(name)
  {
    if (typeof name === "string" & name.startsWith("@")){
      const bs = this.bindings.get(name.slice(1));
      return bs && bs[bs.length-1];
    }else{
      return this.variables.get(name);
    }
  }

}

class EvaluateResult{
  constructor(domNodes, context)
  {
    this.nodes = domNodes;
    this.bindings = context.bindings; // Map
  }

  getNodes()
  {
    return this.nodes;
  }

  getFirstNode()
  {
    return this.nodes[0];
  }

  getFragment()
  {
    const frag = document.createDocumentFragment();
    for (const node of this.nodes){
      frag.appendChild(node);
    }
    return frag;
  }

  getBindingMap()
  {
    return this.bindings;
  }

  getBindings()
  {
    const obj = {};
    for (const [k,v] of this.bindings){
      obj[k] = v[0];
    }
    return obj;
  }
}

class Node{

  /** Evaluate this node into DOM nodes.
   *
   * @param {EvaluateContext} context
   * @return {Array.<window.Node>}
   */
  evaluate(context)
  {
    // abstract
  }

}

/** Represent a whole result of parsing.
 *
 */
class Ast extends Node{
  constructor(nodes)
  {
    super();
    this.nodes = nodes;
  }

  exec(options={})
  {
    const context = new EvaluateContext(options);
    const domNodes = this.evaluate(context);
    return new EvaluateResult(domNodes, context);
  }

  evaluate(ctx)
  {
    return [].concat(...this.nodes.map((nd) => nd.evaluate(ctx)));
  }
}


/** Represent a DOM element.
 */
class Element extends Node{
  constructor(base, attrs, refname, childNodes)
  {
    super();
    this.base = base;
    this.attrs = attrs;
    this.refName = refname;
    this.childNodes = childNodes;
  }

  evaluate(ctx)
  {
    const rec = evalInterpolate(ctx, (v) => {
      if (typeof v === "string"){
        return [document.createElement(v)];
      }else if (v instanceof window.Node){
        return [v];
      }else if (C.isIterable(v)){
        return C.flatten(Array.from(v).map(rec));
      }else{
        throw new TypeError(`Invalid element base: ${v}`);
      }
    });
    const resultElts = rec(this.base);

    for (const elt of resultElts){
      const {attrList, events} = this.makeAttributes(ctx);

      for (const [aname,aval] of attrList){
        elt.setAttribute(aname, aval);
      }

      for (const [evName,evArgs] of events){
        elt.addEventListener(evName, ...evArgs);
      }

      if (this.refName){
        if (ctx.options.attrForRefName){
          elt.setAttribute(ctx.options.attrForRefName, this.refName);
        }
        ctx.addBinding(this.refName, elt);
      }

      if (this.childNodes.length !== 0){
        // emptying innerHTML doesn't work for HTML element
        while (elt.firstChild){
          elt.removeChild(elt.firstChild);
        }
        for (const child of this.childNodes){
          for (const childDOM of child.evaluate(ctx)){
            elt.appendChild(childDOM);
          }
        }
      }
    }

    return resultElts;
  }

  /** Make the final list of attributes and events
   *
   * @return {attrMap:List, events:List}
   *   where List is {iterable.<[name,value]>}
   */
  makeAttributes(ctx)
  {
    const attrMap = new Map;
    const events = [];

    if (!this.attrs){
      return attrMap;
    }
    for (const attr of this.attrs){
      // attr is SplatAttributes or [name,val]
      let keyAndVals;
      if (attr instanceof SplatAttributes){
        keyAndVals = Object.entries(evalInterpolate(ctx)(attr.value));
      }else{
        keyAndVals = [
          [evalInterpolate(ctx)(attr[0]), evalInterpolate(ctx)(attr[1])]
        ];
      }
      for (const [aname,aval] of keyAndVals){
        if (typeof aname !== "string"){
          throw new TypeError(`Invalid attribute name: ${aname}`);
        }
        if (aname.startsWith("!")){ // !click=${func}
          const eventArgs = Array.isArray(aval) ? aval : [aval];
          events.push([aname.slice(1), eventArgs]);
        }else{
          if (attrMap.has(aname)){ // space-separated attrs
            attrMap.set(aname, `${attrMap.get(aname)} ${aval}`);
          }else{
            switch (aval){
              case true: // boolean attribute
                attrMap.set(aname, "");
                break;
              case false: // nop
                break;
              default:
                attrMap.set(aname, aval);
            }
          }
        }
      }
    }
    return {attrList: attrMap, events};
  }
}

class SplatAttributes {
  constructor(value)
  {
    this.value = value;
  }
}

class Text extends Node{
  constructor(content)
  {
    super();
    this.content = content;
  }

  evaluate()
  {
    return [document.createTextNode(this.content)];
  }
}

class NewLine extends Node{
  constructor(content="\n")
  {
    super();
    this.content = content;
  }

  evaluate()
  {
    return [document.createTextNode("\n")];
  }
}

class InterpolateText extends Node{
  constructor(value)
  {
    super();
    this.value = value;
  }

  evaluate(ctx)
  {
    const rec = evalInterpolate(ctx, (v) => {
      if (typeof v === "string"){
        return [document.createTextNode(v)];
      }else if (typeof v === "number"){
        return [document.createTextNode(v.toString())];
      }else if(v == null){
        return [document.createTextNode("")];
      }else if(v instanceof window.Node){
        return [v];
      }else if (C.isIterable(v)){
        return C.flatten(Array.from(v).map(rec));
      }else{
        throw new TypeError(`Invalid text: ${v}`);
      }
    });
    return rec(this.value);
  }
}

class If extends Node{
  constructor(cond, thenNodes, elseNodes)
  {
    super();
    this.cond = cond;
    this.thenNodes = thenNodes;
    this.elseNodes = elseNodes || [];
  }

  evaluate(ctx)
  {
    const cond = evalInterpolate(ctx)(this.cond);
    return C.flatten((cond ? this.thenNodes : this.elseNodes).map( (nd) => nd.evaluate(ctx)));
  }
}

class For extends Node{
  constructor(variable, iterable, childNodes)
  {
    super();
    this.variable = variable;
    this.iterable = iterable;
    this.childNodes = childNodes;
  }

  evaluate(ctx)
  {
    const list = evalInterpolate(ctx)(this.iterable);
    const resultNodes = [];
    for (const val of list){
      ctx.letVariableIn(this.variable, val, () => {
        for (const child of this.childNodes){
          resultNodes.push(...child.evaluate(ctx));
        }
      });
    }
    return resultNodes;
  }
}

class Ref{
  constructor(variableNames, callback)
  {
    this.variableNames = variableNames;
    this.callback = callback;
  }

  exec(ctx)
  {
    return this.callback(...this.variableNames.map(ctx.getVariable.bind(ctx)));
  }
}

/** See list as a tree and map its leaves into an array.
 *  Leaves are nodes to which f returns non-null value.
 *  Internal nodes are nodes which are iterable and to which
 *  f returns null. A node which is neither a leave nor an
 *  internal node raises an error.
 *
 * @param {object->{object|Array.{object}|null}}
 * @return {Array}
 */
function treeFlatMap(f, list)
{
  return (function map(node){
    const leafVal = f(node);
    if (leafVal == null){
      if (node[Symbol.iterator]){
        return [].concat(...Array.from(node).map(map));
      }else{
        throw new TypeError(`invalid value: ${node}`);
      }
    }else{ // node is a leaf
      return Array.isArray(leafVal) ? leafVal : [leafVal];
    }
  })(list);
}

/* Provides common operations to evaluate interpolations.
 * This function is 'curried' so that the caller can recursively
 * evaluate the value.
 */
function evalInterpolate(ctx, f=((x)=>x))
{
  return function rec(ipValue){
    if (ipValue instanceof Ref){
      return rec(ipValue.exec(ctx));
    }else{
      return f(ipValue);
    }
  }
}


//export default {
module.exports = {
  Node,
  Ast,
  Element,
  Text,
  NewLine,
  InterpolateText,
  If,
  For,
  Ref,
  SplatAttributes
};
