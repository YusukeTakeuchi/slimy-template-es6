const Ast = require("../src/ast");
const Parser = require("../src/parser");
const htmlparser = require("htmlparser2");
const chai = require("chai");
const expect = chai.expect;
const jsdom = require("jsdom");

/* We use htmlparser2 to compare DOM and HTML since
 * full-fledged DOM's behavior is too complex to track.
 * (Parsing HTML into DOM and comparing it with other nodes
 * is a really tricky thing we should avoid. You might think
 * you could simply use set innerHTML of <template> and call
 * .isEqualNode(), but what happens when <html> is inserted
 * to <template>?)
 */

function parseHtmlToHTMLParser2Result(html)
{
  return removeSomeAttrs(htmlparser.parseDOM(html));

  function removeSomeAttrs(nodes)
  {
    for (const node of (nodes || [])){
      delete node.next;
      delete node.prev;
      delete node.parent;
      removeSomeAttrs(node.children);
    }
    return nodes;
  }
}

/** Convert an array of nodes to an array of objects
 *  each of which is a subset that htmlparser2 generates.
 *  This function is meant for testing purpose.
 *
 * @param {Array.<window.Node>} nodes
 *
 * @return {Array.<object>} object has attributes:
 *   type: 'tag', 'text', 'script' or 'style'
 *
 *   attributes for type=text:
 *     data: textContent
 *
 *   attributes for type=tag,script,style
 *     name: {string} tagName
 *     attribs: {object} attributes
 *     children: {Array.<dom node>} child nodes
 *
 *  texts in nodes are normalized.
 */
function domNodesToHTMLParser2Result(nodes)
{
  return normalizeTextNodes(nodes.map(domToResult));

  function domToResult(domNode)
  {
    switch (domNode.nodeType){
      case window.Node.TEXT_NODE:
        return {
          type: "text",
          data: domNode.data
        };
      case window.Node.ELEMENT_NODE:
        const name = domNode.tagName.toLowerCase();

        const type = {
          "script": "script",
          "style": "style",
        }[name] || "tag";

        const attribs = {};
        for (const {name,value} of Array.from(domNode.attributes)){
          attribs[name] = value;
        }

        const children = domNodesToHTMLParser2Result(Array.from(domNode.childNodes));

        return {
          type, name, attribs, children,
        };
      default:
        throw `dom node ${domNode.nodeName} not supported`;
    }
  }

  function normalizeTextNodes(nodes)
  {
    const resultNodes = [];
    for (const node of nodes){
      if (isTextNode(node) && isTextNode(resultNodes[resultNodes.length-1])){
        const lastTextNode = resultNodes.pop();
        resultNodes.push({  // join text data
          type: "text",
          data: lastTextNode.data + node.data
        });
      }else{
        resultNodes.push(node);
      }
    }
    return resultNodes;
  }

  function isTextNode(node){ return node && node.type === "text"; }
}

/**
 * @param {Ast.Ast} parsed
 * @param {string} result html that represents expected result
 */
function expectHTML(parsed, result)
{
  const actual = domNodesToHTMLParser2Result(
    parsed.exec({attrForRefName: "data-refname"}).getNodes());
  const expected = parseHtmlToHTMLParser2Result(result);

  expect(actual).to.deep.equal(expected);
}


const parse = Parser.parse.bind(Parser);

/**
 * @param {string|Array.<string>} names
 * @param {...object->object} f
 */
function referenceVariable(names, f=(x)=>x)
{
  return new Ast.Ref(Array.isArray(names) ? names : [names], f);
}

/** Copy necessary DOM components to global scope.
 */
function setupDOM()
{
  if (!global){
    return;
  }

  const neededProperties = [
    "window", "document", "Node"
  ];
  const jd = new jsdom.JSDOM('<!DOCTYPE HTML><html></html>');
  for (const p of neededProperties){
    global[p] = global[p] || jd.window[p];
  }
}

module.exports = {
  expectHTML,
  parse,
  setupDOM,
  referenceVariable
};
