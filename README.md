# Slimy

Slimy is a Slim-like template library that generates DOM trees.

## Example

```js
const {slim} = require("slimy-template-es6");
const container = slim`
  #container
    - if ${user}
      h2.registered You are logged in as ${user.name}.
    - else
      h2.guest You are not logged in.
`;
```
`container` results in a DOM element whose `outerHTML` is
```html
<div id="container"><h2 class="registered">You are logged in as Bob.</h2></div>
```
when `user` is `{name: "Bob"}`.
Note that ES6's (tagged) template literal is used here.


## Line indicators

### Text `|` `'`
`|` and `'` indicate text.
```js
slim`
  p
    | Text
`
```
results in
```html
<p>text</p>
```
`'` will append a single trailing white space.

You can embed text or DOM node in text lines with interpolations.

```js
slim`
  body
    | ${document.createElement("HR")} ${"abc"}
`
```
results in
```html
<body><hr> abc</body>
```

### Attributes

```js
slim`
  a href="http://example.com/" class=external target=${"_blank"} Go out
`
```
results in
```html
<a href="http://example.com/" class="external" target="_blank">Go out</a>
```
Note that there is no quotation in `class=external`. Unlike Slim, strings outside of interpolations will not evaluated as code.

#### Attribute wrapper
Just like Slim.
```js
slim`
h2 [ id = "tagline" contenteditable] ${page_tagline}
`;
```

#### Event attributes
If an attribute name starts with `!`, the attribute is not set normally but the value is registered as an event listener.

```js
slim`
  div !click=${(e) => console.log("clicked")} Click Me!
`
```
is equivalent to
```js
const div = slim`
  div Click me!
`;
div.addEventListener("click", (e) => console.log("clicked"));
```
The attribute value can be a function or an Array. If it is an Array, each element is passed as an argument to `addEventListener`.

### Embedded elements
You can embed DOM nodes.
```js
const a = document.createElement("A");
a.href = "next.html";
a.innerHTML = "go";
slim`
  div
    ${a}
`
```
results in
```html
<div><a href="next.html">go</a></div>
```
Attributes and child nodes of embedded elements can be set.
```js
const a = document.createElement("A");
a.href = "next.html";
a.innerHTML = "nothing";
slim`
  ${a} class="nav"
    | Next
`;
console.log(a.className); // => nav
console.log(a.innerHTML); // => Next
```
Note that if there are child nodes in the template, the embedded element's old children are cleared. But if there is no child node in the template, it keeps its children intact.

### Control flow
Only `if` and `for` is supported.
```js
slim`
  p
    - if ${loggedIn}
      | You are logged in
    - else
      | You are not logged in
`
```
```js
const {slim,ref} = require("slimy-template-es6");
slim`
  - for post of ${userPosts}
    li ${ref("post", (post) => post.title)}
`
```
To access the variable set by `for`, you need to use `ref` function. `ref` takes a name or an array of names as the first parameter, and it calls the second argument with the values of the specified variables.

### Element bindings

By putting `@`name after attributes, you can name the element.
```js
const {slimBind} = require("slimy-template-es6");
const {par,link} = slimBind`
  p.p @par
    a href="/login" @link Login
`
```
`slimBind` returns an object that contains the name and elements specified by `@`.


### APIs

```js
const Slimy = require("slimy-template-es6");
Slimy.slim`...`; // evaluate Slimy template and returns the first node.
Slimy.slimFrag`...`; // same as slim, but returns DocumentFragment.
Slimy.slimBind`...`; // same as slim, but returns an object of @bindings.
Slimy.ref; // reference variables
```

## Links

* [Slim](http://github.com/slim-template/slim)
* [Slm](https://github.com/slm-lang/slm)
