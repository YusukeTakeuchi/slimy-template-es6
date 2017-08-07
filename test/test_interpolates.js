const {
  expectHTML, parse: p,
  setupDOM,
} = require("./helper");

setupDOM();

describe("Interpolate", () => {
  describe("text context", () => {
    it("interprets in element", () => {
      expectHTML(p`
        div Hello, ${"World!"}
      `,
      '<div>Hello, World!</div>');
    });

    it("interprets in pipe", () => {
      expectHTML(p`
        div
          | Hello, ${"World!"}
      `,
      '<div>Hello, World!</div>');
    });

    it("interprets dom node", () => {
      const a = document.createElement("A");
      a.href = "link.html";
      a.textContent = "LINK";
      expectHTML(p`
        div: p See ${a}
      `,
      '<div><p>See <a href="link.html">LINK</a></p></div>');
    });

    it("interprets DOM node just after element", () => {
      const a = document.createElement("A");
      a.href = "link.html";
      a.textContent = "LINK";
      expectHTML(p`
        div ${a}
      `,
      '<div><a href="link.html">LINK</a></div>');
    });

    it("inteprets list", () => {
      expectHTML(p`
        | ${["Text1","Text2"]}
      `,
      'Text1Text2');
    });

    it("inteprets mixed list", () => {
      const a = document.createElement("A");
      a.textContent = "Click";
      a.className = "external";
      expectHTML(p`
        | ${["Text1", a, "Text2"]}
      `,
      'Text1<a class="external">Click</a>Text2');
    });
  });

  it("interprets attr value", () => {
    expectHTML(p`
      div class=${"container" + 2}
        | Hello
    `,
    '<div class="container2">Hello</div>');
  });

  it("interprets empty attr value", () => {
    expectHTML(p`
      div data-secret=${""} ???
    `,
    '<div data-secret="">???</div>');
  });

  it("interprets attr name", () => {
    expectHTML(p`
      div ${"data-foo"}=44
        bar
    `,
    '<div data-foo="44"><bar></bar></div>');
  });

  it("interprets boolean attr", () => {
    expectHTML(p`
      input ( type=checkbox id=foo   ${"checked"} )
    `,
    '<input type=checkbox id=foo checked>');
  });


  describe("element", () => {
    it("interprets tag name", () => {
      expectHTML(p`
        ${"foo"}#main
          | Text
      `,
      '<foo id="main">Text</foo>');
    });

    it("interprets empty element", () => {
      expectHTML(p`
        ${document.createElement("BR")}
      `,
      '<br>');
    });

    it("keeps attributes and children if not written", () => {
      const pa = document.createElement("P");
      const span = document.createElement("SPAN");
      span.className = "sp";
      span.textContent = "Try it";
      pa.appendChild(span);
      pa.appendChild(document.createTextNode(" XY"));
      expectHTML(p`
        ${pa}
      `,
      '<p><span class="sp">Try it</span> XY</p>');
    });

    it("clears old children if new children exist", () => {
      const pa = p`
        div { contenteditable }: x: y: z Text
          Text2
      `.exec().getFirstNode();
      expectHTML(p`
        ${pa}
          nav Welcome
      `,
      '<div contenteditable=""><nav>Welcome</nav></div>');
    });

    it("handles list of elements", () => {
      expectHTML(p`
        ${["foo1","foo2","foo3"]}
      `,
      '<foo1></foo1><foo2></foo2><foo3></foo3>');
    });
  });

  it("interprets id/class shorthand", () => {
    expectHTML(p`
      .${"menu-open"} ${"Collapse"}
    `,
    '<div class="menu-open">Collapse</div>');

    expectHTML(p`
      textarea#${"editor"}
    `,
    '<textarea id="editor"></textarea>');
  });

  it("interprets @ref", () => {
    expectHTML(p`
      h1 @${"header"} Today's Weather
    `,
    '<h1 data-refname="header">Today\'s Weather</h1>');
  });
});
