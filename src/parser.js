const Ast = require("./ast");
const C = require("./common");
const InputStream = require("./inputstream");

/*********************************************
 * utility functions
 *********************************************/

/** Compare indents of two strings.
 *
 * Indents can contain mixed spacing chars (spaces,tabs, ...),
 * and we do not normalize them because that can be confusing and
 * lead to annoying bugs. Instead, we regard indents only partially ordered.
 */
function compareIndent(s1, s2)
{
  const indent = /^[ \t]*/.exec(s1)[0];
  const other = /^[ \t]*/.exec(s2)[0];
  if (indent === other){
    return "eq";
  }else if (indent.startsWith(other)){
    return "gt";
  }else if (other.startsWith(indent)){
    return "lt";
  }else{
    return "incomparable";
  }
}

function trimIndent(text, indent)
{
  switch (compareIndent(text, indent)){
    case "gt":
    case "eq":
      return text.slice(indent.length);
    case "lt":
      return text.replace(/^[ \t]*/, '');
    case "incomparable":
      return text;
    default:
      throw "must not happen (invalid value for compareIndent)";
  }
}

function removeLastNewLineNodes(nodes)
{
  while (nodes[nodes.length-1] instanceof Ast.NewLine){
    nodes.pop();
  }
  return nodes;
}


/**************************************
 * class definitions
 **************************************/

class ParseError extends Error {
  static create(msg, inputStream)
  {
    const err = new this(`${msg}: {${inputStream.currentSegment}}`);
    err.input = inputStream;
    return err;
  }
}

class Parser{
  static parse(segments, ...interpolates)
  {
    return new Ast.Ast(
      (new this(InputStream.create(segments, interpolates))).parse()
    );
  }

  /**
   * @param {InputStream} inputStream
   */
  constructor(inputStream)
  {
    this.input = inputStream;
  }

  parse()
  {
    this.skipEmptyLines();
    const initialIndent = this.parseIndent();
    const block = this.parseBlock(initialIndent);
    if (!this.input.isEoF()){
      const indentAfterFinished = this.parseIndent();
      switch (compareIndent(indentAfterFinished,initialIndent)){
        case "lt":
        case "incomparable":
          this.syntaxError("malformed indent");
          break;
        case "gt":
        case "eq":
          console.error(this.input);
          //throw new Error("internal error: something goes wrong when parsing");
          this.syntaxError("incomparable indent found");
          break;
      }
    }
    return block;
  }

  /** Parse a block.
   *  Assume preceding indent is already consumed.
   *
   */
  parseBlock(indent)
  {
    const nodes = this.parseBlockAlternative(indent);
    if (!nodes){
      return null;
    }
    this.parseMany( () => {
      if (!this.parseIndentEq(indent)){
        return null;
      }
      if (this.input.peek(/^[ \t]+/)){
        this.syntaxError("malformed indent");
      }
      return this.parseBlockAlternative(indent);
    }).forEach( (followingNodes) => {
      nodes.push(...followingNodes);
    });

    return nodes;
  }

  parseBlockAlternative(indent)
  {
    const result =
            this.parseComment(indent) ||
            this.parseTextBlock(indent) ||
            this.parseElement(indent) ||
            this.parseControlFlow(indent) ||
            this.parseEmptyLine();

    if (!result && !this.input.isEoF()){
      this.syntaxError("unknown indicator");
    }

    return result;
  }

  /**
   * @param {({value}|null)->(Ast.Node|Array.<Ast.Node>)} f process interpolation or text.
   *   An object with property 'value' is passed for interpolation, null otherwise.
   *   Normally f should not consume "\n".
   *
   * @param {string->(Ast.Node|Array.<Ast.Node>)} fNl process newline
   *
   * @return {Array.<Ast.Node>}
   */
  parseUntilNewline(f, fNl=null)
  {
    const result = [];
    let nl = null;
    while(!(nl = this.parseNewline()) && !this.input.isEoF()){
      const ip = this.input.consumeInterpolate();
      const vs = f(ip);
      if (vs){
        result.push(...C.arrayify(vs));
      }
    }
    const nlNodes = nl && fNl && fNl(nl);
    if (nlNodes){
      result.push(...C.arrayify(nlNodes));
    }
    return result;
  }

  parseNewline()
  {
    return this.input.consumeMatched(/^\n/);
  }

  /** Parse an empty line and return string of the line.
   *
   * Don't return empty string.
   * @return {string|null} string is non-empty
   */
  parseEmptyLine()
  {
    // peekEmptyLine rejects empty string
    return this.peekEmptyLine() && this.input.consume(/^[ \t]*\n?/);
  }

  skipEmptyLines()
  {
    this.parseMany( () => this.parseEmptyLine() );
    return true;
  }

  /**
   * @return {Array.<Ast.Node>} always empty
   */
  parseComment(indent)
  {
    const ignoreUntilNewline = () => {
      this.parseUntilNewline((ip) => {
        this.input.consume(/^.*/);
      });
    };
    if (!this.input.consume(/^\//)){
      return null;
    }
    ignoreUntilNewline();
    while (this.parseIndentGt(indent) || this.peekEmptyLine()){
      ignoreUntilNewline();
    }
    return [];
  }

  /** Parse lines that begin with "|" or "'".
   *  A trailing space added if "'" is used.
   *
   * @return {Array.<Ast.Node>}
   */
  parseTextBlock(indent)
  {
    const sym = this.input.consumeMatched(/^(\||')/);
    if (!sym){
      return null;
    }
    const trailingSpace = (sym === "'");
    const addTrailingSpace = (nodes) => {
      if (trailingSpace){
        nodes.push(new Ast.Text(" "));
      }
      return nodes;
    };

    const indentFirstLine = indent + (this.input.consume(/^ /) ? "  " : " ");
    const nodesFirstLine = this.parseTextLine();
    if (nodesFirstLine.length == 1 && nodesFirstLine[0] instanceof Ast.NewLine){
      // no text after |
      this.skipEmptyLines();
      const firstNonEmptyLineIndentMd = this.parseIndentGt(indent);
      if (firstNonEmptyLineIndentMd){
        // base indent is determined by the first non-empty line
        const texts = this.parseTextLine().concat(
          this.parseContinuedTextBlockCommon(indent, firstNonEmptyLineIndentMd[0]));
        return addTrailingSpace(removeLastNewLineNodes(texts));
      }else{
        return []; // no content at all
      }
    }else{
      return addTrailingSpace(
               removeLastNewLineNodes(
                 nodesFirstLine.concat(
                   this.parseContinuedTextBlockCommon(indent, indentFirstLine))));
    }
  }

  /**
   *  Parse text lines that have deeper indents than indent.
   *  Indents less than indenToTrim will be trimmed.
   *  Empty lines are parsed whatever their indent is.
   *
   *  This method will be called when a text block is parsed (both in pipe and element)
   *  The last newline will NOT be removed.
   */
  parseContinuedTextBlockCommon(indent, indentToTrim)
  {
    return C.flatten(
      this.parseMany( () => {
        const emptyLine = this.parseEmptyTextLine();
        if (emptyLine != null){
          return emptyLine;
        }
        const childIndentMd = this.parseIndentGt(indent);
        if (childIndentMd != null){
          const indentStr = trimIndent(childIndentMd[0], indentToTrim);
          return ((indentStr.length > 0) ?  [new Ast.Text(indentStr)] : []).concat(
            this.parseTextLine()
          );
        }
        return null;
      })
    );
  }

  /**
   * @return {array.<Node>|null} array is empty or contains an NewLine node
   */
  parseEmptyTextLine()
  {
    const line = this.parseEmptyLine();
    if (line){
      if(/\n$/.test(line)){ // has newline
        return [new Ast.NewLine];
      }else{ // spaces followed by EOF, no node
        return [];
      }
    }else{
      return null;
    }
  }

  /** parse a text line (newline will be consumed if any)
   *
   * @return {Array.<Ast.Node>}
   */
  parseTextLine()
  {
    return this.parseUntilNewline( (ip) => {
      if (ip){
        return new Ast.InterpolateText(ip.value);
      }else{
        const text = this.input.consumeMatched(/^.*/);
        return new Ast.Text(text);
      }
    }, (nl) => (new Ast.NewLine(nl)));
  }

  parseChildBlock(parentIndent)
  {
    this.skipEmptyLines();
    const childIndentMd = this.parseIndentGt(parentIndent);
    return childIndentMd ? this.parseBlock(childIndentMd[0]) : [];
  }

  /**
   * @return {Array.<Ast.Node>} contains an element and spacer texts around it if any
   */
  parseElement(indent)
  {
    const tagBase = ( () => {
      const tagIp = this.input.consumeInterpolate();
      const tagName = (!tagIp) && this.parseTagName();
      return tagIp ? tagIp.value : tagName;
    })();

    const idAndClasses = this.parseIdAndClassesShorthand();
    if (!tagBase && !idAndClasses){
      return null;
    }
    const spacer = this.parseTagSpacer();

    const attrs = this.parseAttrs();
    const refName = this.parseNameRef();

    if (idAndClasses){
      attrs.unshift(...idAndClasses.map( ([symbol,val]) => (
        [{".":"class", "#":"id"}[symbol], val]
      )));
    }


    this.parseOptionalSingleSpace();

    let childNodes = [];

    if (this.input.consume(/^[ \t]*:/)){ // div : span
      this.skipSpaces();
      childNodes = this.parseElement(indent);
    }else{
      const texts = this.parseTextLine();
      this.skipEmptyLines();
      if (texts.every((node) => node instanceof Ast.NewLine)){
        // no text, parse child block
        childNodes = this.parseChildBlock(indent);
      }else{
        // continue parsing texts to the next line
        const nextLineIndentMd = this.parseIndentGt(indent);
        if (nextLineIndentMd){
          texts.push(...this.parseTextLine());
          texts.push(...this.parseContinuedTextBlockCommon(indent, nextLineIndentMd[0]));
        }
        childNodes = removeLastNewLineNodes(texts);
      }
    }

    const result = [new Ast.Element(tagBase||'div', attrs, refName, childNodes)];
    if (spacer.before){
      result.unshift(new Ast.Text(" "));
    }
    if (spacer.after){
      result.push(new Ast.Text(" "));
    }
    return result;
  }

  parseTagName()
  {
    // tag name cannot start with '-'
    // tag name cannot end with ':'
    return this.input.consumeMatched(/^(?!-)[\w:_\-]*[\w_\-]/);
  }

  parseIdAndClassesShorthand()
  {
    return this.parseManyOne( () => {
      const op = this.input.consumeMatched(/^(\.|#)/);
      if (!op){
        return null;
      }
      const ident = this.parseIdentifier();
      if (!ident){
        this.syntaxError(`ident expected after ${op}`);
      }
      return [op, ident];
    });
  }

  parseIdentifier()
  {
    return this.parseInterpolateOrMatch(/^[\w_\-]+/);
  }

  /**
   *
   * foo<>, foo<, foo>
   * foo<<<<>>>>><<><>> is also ok
   * @return {{before: {boolean}, after:{boolean}}
   */
  parseTagSpacer()
  {
    const spacer = {
      before: false,
      after: false
    };
    let md = null;
    while (md = this.input.consume(/^(<|>)/)){
      switch (md[0]){
        case '<':
          spacer.before = true;
          break;
        case '>':
          spacer.after = true;
          break;
        default:
          throw "must not happen";
      }
    }
    return spacer;
  }

  parseAttrs()
  {
    const mdParen = this.input.consume(/^[ \t]*(\(|\{|\[)/);
    if (mdParen){
      const parenEnd = {"(":")",  "{":"}",  "[":"]" }[mdParen[1]];
      const finishRE = new RegExp(`^\\s*\\${parenEnd}`);
      return this.parseMany( () => {
        if (this.input.isEoF()){
          this.syntaxError("unclosed attr list");
        }
        if (this.input.consume(finishRE)){
          return null;
        }
        const splatAttrs = this.parseSplatAttrs(true);
        if (splatAttrs != null){
          return splatAttrs;
        }
        const attrPair = this.parseAttrNameAndValue(true);
        if (attrPair != null){
          return attrPair;
        }
        const emptyAttrName = this.parseEmptyAttrName();
        if (emptyAttrName != null){
          return [emptyAttrName, true];
        }
        this.syntaxError("attr name expected");
      });
    }else{
      return this.parseMany( () => {
        const splatAttrs = this.parseSplatAttrs(false);
        if (splatAttrs != null){
          return splatAttrs;
        }
        const attrPair = this.parseAttrNameAndValue(false);
        if (attrPair != null){
          return attrPair;
        }
        return null;
      });
    }
  }

  /** Parse [spaces]key=value
   *
   * @return {Array} [key,val]
   */
  parseAttrNameAndValue(allowNewLineAsSpace)
  {
    const attrName = this.parseAttrNameAndEqual(allowNewLineAsSpace);
    if (attrName == null){
      return null;
    }
    const attrValue = this.parseAttrValue();
    if (attrValue == null){
      this.syntaxError("attr value expected after =");
    }
    return [attrName, attrValue];
  }

  /** Parse [spaces]*${attrsObj}
   */
  parseSplatAttrs(allowNewLineAsSpace)
  {
    if (!this.input.consume(allowNewLineAsSpace ? /^\s*\*/ : /^[ \t]*\*/)){
      return null;
    }
    this.skipSpaces(allowNewLineAsSpace);
    const ip = this.input.consumeInterpolate() ||
      this.syntaxError("Object expected after splat attribute *");
    return new Ast.SplatAttributes(ip.value);
  }

  /** Parse [spaces]key[spaces]=[spaces]
   *
   * @return {String|object} key
   */
  parseAttrNameAndEqual(allowNewLineAsSpace)
  {
    const skipSpaces = () => {
      this.skipSpaces(allowNewLineAsSpace);
    };

    return this.tryParse( () => {
      skipSpaces();
      const name = this.parseInterpolateOrMatch(/^[^\s"'<>=\(\)\{\}\[\]\/]+/);
      if (name == null){
        return null;
      }
      skipSpaces();
      if (this.input.consumeString("=") == null){
        return null;
      }
      skipSpaces();
      return name;
    });
  }

  // e.g. 'contenteditable' in 'div { contenteditable }'
  parseEmptyAttrName()
  {
    return this.tryParse( () => {
      // Allow new lines as space since this method should be call
      // only in a context of attribute wrapper.
      this.input.consume(/^\s*/);
      return this.parseInterpolateOrMatch(/^[^\s"'<>=\(\)\{\}\[\]\/]+/);
    });
  }

  /** parse after '=' (preceding spaces already consumed)
   */
  parseAttrValue()
  {
    let ip = null;
    if (ip = this.input.consumeInterpolate()){
      return ip.value;
    }else if (this.input.consume(/^"/)){
      return this.input.consumeCaptured(/^([^\n"]*)"/) ||
          this.syntaxError("unclosed quotation");
    }else if (this.input.consume(/^'/)){
      return this.input.consumeCaptured(/^([^\n']*)'/) ||
          this.syntaxError("unclosed quotation");
    }else{
      return this.input.consumeMatched(/^[^\s"'<>=\/]*/);
    }
  }

  /** Parse:
   *    [spaces]@name
   */
  parseNameRef()
  {
    if (this.input.consume(/^[ \t]*@/)){
      return this.parseIdentifier() || this.syntaxError("ident expected after @");
    }else{
      return null;
    }
  }

  parseControlFlow(indent)
  {
    const instruction = this.parseControlFlowInstruction(); // if, for
    if (!instruction){
      return;
    }
    const parsingMethod = this['parseControlFlow_' + instruction] ||
                            this.syntaxError(`Invalid instruction: ${instruction}`);
    this.skipSpaces();
    return parsingMethod.call(this, indent);
  }

  /** parse like '- if  '  (no space before -, trailing spaces consumed)
   */
  parseControlFlowInstruction()
  {
    if (!this.input.consume(/^-/)){
      return null;
    }
    this.skipSpaces();
    return this.input.consumeMatched(/^\w+/);
  }

  parseControlFlow_if(indent)
  {
    const condIp = this.input.consumeInterpolate() ||
                this.syntaxError("Condition expected after 'if'");
    if (!this.parseEmptyLine){
      this.syntaxError("newline expected after if condition");
    }
    const childrenThen = this.parseChildBlock(indent);
    if ( // else block exists?
      this.tryParse( () => (
        this.parseIndentEq(indent) &&
          this.parseControlFlowInstruction() == "else" ? true : null
      ))
    ){
      this.parseEmptyLine() || this.syntaxError("newline expected after if condition");
      const childrenElse = this.parseChildBlock(indent);
      return [new Ast.If(condIp.value, childrenThen, childrenElse)];
    }else{
      return [new Ast.If(condIp.value, childrenThen, null)];
    }
  }

  parseControlFlow_for(indent)
  {
    const variable =
      this.input.consumeMatched(/^[\w_\-]+/) ||
        this.syntaxError("Variable name expected after 'for'");

    this.input.consume(/^[ \t]+of[ \t]*/) ||
      this.syntaxError("'of' expected after for var");

    const iterableIp =
      this.input.consumeInterpolate() ||
        this.syntaxError("Iterated value expected after 'of'");

    this.parseEmptyLine() || this.syntaxError("newline expected after iterated value");
    const children = this.parseChildBlock(indent);
    return [new Ast.For(variable, iterableIp.value, children)];
  }

  /***********************
   * generic methods
   ***********************/


  parseIndent()
  {
    return this.parseSpaces(false);
  }

  parseIndentEq(indent)
  {
    return (this.input.consumeString(indent) != null);
  }

  /**
   *
   * @return {matchdata} [1] contains the base indent, [2] the extra indent
   */
  parseIndentGt(indent)
  {
    return this.input.consume(new RegExp(`^(${indent})([ \t]+)`));
  }

  peekEmptyLine()
  {
    const md = this.input.peek(/^[ \t]*\n/) || this.input.peekToEoF(/^[ \t]*/);
    if (md && md[0].length !== 0){
      return md;
    }else{
      return null;
    }
  }

  parseOptionalSingleSpace()
  {
    return this.input.consumeMatched(/^[ \t]?/);
  }

  parseSpaces(allowNewLineAsSpace=false)
  {
    return this.input.consumeMatched(allowNewLineAsSpace ? /^\s*/ : /^[ \t]*/);
  }

  skipSpaces(allowNewLineAsSpace)
  {
    this.parseSpaces(allowNewLineAsSpace);
    return true;
  }

  parseMany(f)
  {
    const result = [];
    let parsed = null;
    while (parsed = f()){
      result.push(parsed);
    }
    return result;
  }

  parseManyOne(f)
  {
    const parsed = f();
    return parsed && [parsed].concat(this.parseMany(f));
  }

  /** Wrap InputStream#tryParse
   */
  tryParse(f)
  {
    return this.input.tryParse( (tryIs) => {
      const originalInput = this.input;
      try{
        this.input = tryIs;
        return f();
      }finally{
        this.input = originalInput;
      }
    });
  }

  tryPeek(f)
  {
    let result;
    this.tryParse( () => {
      result = f();
      return null;
    });
    return result;
  }

  expect(value, msg)
  {
    return value || this.syntaxError(msg);
  }

  parseInterpolateOrMatch(regex, ipHandler=(v)=>v, mdHandler=(md)=>md[0])
  {
    const ip = this.input.consumeInterpolate();
    if (ip){
      return ipHandler(ip.value);
    }else{
      const md = this.input.consume(regex);
      if (md == null){
        return null;
      }else{
        return mdHandler(md);
      }
    }
  }

  syntaxError(msg)
  {
    console.error(this.input);
    throw ParseError.create(msg, this.input);
  }

}

module.exports = Parser;
