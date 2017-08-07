const chai = require("chai");
const expect = chai.expect;

const {
  expectHTML, parse: p
} = require("./helper");

describe("Extra features of Parser", () => {
  it("interpret @ as refname", () => {
    expectHTML(p`
      h1#main-header @header
        | Hello!
      `
    ,
    '<h1 id="main-header" data-refname="header">Hello!</h1>');
  });

  it("handle spaced empty lines properly after |", () => {
    expectHTML(p`
        | text1
      `
    ,
    'text1');
  });

  it("handle spaced empty lines properly after element", () => {
    expectHTML(p`
        span text1
          text2
      `
    ,
    '<span>text1\ntext2</span>');
  });

  it("recognize omitted boolean attr in wrapper", () => {
    expectHTML(p`
      .editor ( contenteditable ) Input here
    `,
    '<div class="editor" contenteditable="">Input here</div>');
  });

  it("bind variables correctly", () => {
    const {main, header, footer} = p`
      header#my-header @header
      .main @main
        | This is the main content
      footer#footer
    `.exec().getBindings();
    expect(main).to.be.instanceOf(window.Node);
    expect(main).to.have.property("tagName", "DIV");
    expect(main).to.have.property("textContent", "This is the main content");
    expect(header).to.have.property("id", "my-header");
    expect(footer).not.to.be.ok;
  });

  it("handles event attributes", () => {
    let fired = false;
    const div = p`
      div !myevent=${() => {fired=true}} Click!
    `.exec().getFirstNode();
    div.dispatchEvent(new window.CustomEvent("myevent"));
    expect(fired).to.be.true;
  });

  it("handles event attributes with array", () => {
    let fired = false;
    const div = p`
      div !myevent=${[() => {fired=true}, true]} Click!
    `.exec().getFirstNode();
    div.dispatchEvent(new window.CustomEvent("myevent"));
    expect(fired).to.be.true;
  });

  it("renders undefined to empty text", () => {
    expectHTML(p`
      | A${void(0)}B
    `,
    'AB');
  });

  it("sets attributes by splat attrs", () => {
    expectHTML(p`
      a *${{href: "next.html", class:"nav", rel:"next"}} Next Page
    `,
    '<a href="next.html" class="nav" rel="next">Next Page</a>');
  });

  it("sets attributes by splat attrs in wrapper", () => {
    expectHTML(p`
      a [*
        ${{href: "next.html", class:"nav", rel:"next"}} ${"ok"}
      ] Next Page
    `,
    '<a href="next.html" class="nav" rel="next" ok="">Next Page</a>');
  });
});
