const chai = require("chai");
const expect = chai.expect;

const {
  expectHTML, parse: p,
  referenceVariable: ref
} = require("./helper");

describe("Control flows", () => {
  describe("if", () => {
    it("renders children if cond is true", () => {
      expectHTML(p`
        - if ${true}
          | Ok
      `,
      'Ok');
    });

    it("doesn't render children if cond is false", () => {
      expectHTML(p`
        | 1
        - if ${false}
          | Ok
        | 2
      `,
      '12');
    });

    it("renders then children if cond is true", () => {
      expectHTML(p`
        - if ${true}
          .true Yes
        -else
          .false No
      `,
      '<div class="true">Yes</div>');
    });

    it("renders else children if cond is false", () => {
      expectHTML(p`
        - if ${false}
          .true Yes
        -else
          .false No
      `,
      '<div class="false">No</div>');
    });

    it("handles nested ifs", () => {
      expectHTML(p`
        - if ${true}
          | 1
          - if ${true}
            | 2
            - if ${false}
              | 3
            - else
              | 4
            | 5
        - else
          | 6
      `,
      '1245');
    });
  });

  describe("for", () => {
    it("iterates the same times as iterable", () => {
      expectHTML(p`
        - for x of ${["foo", "bar", "baz"]}
          | 33
      `,
      '333333');
    });

    it("binds variable", () => {
      expectHTML(p`
        - for v of ${[1,2,3,4]}
          | ${ref("v", (v) => `_${v}_`)}
      `,
      '_1__2__3__4_');
    });

    it("variable used in attr name", () => {
      expectHTML(p`
        - for _k of ${["a", "b", "c"]}
          div ${ref("_k", (k) => `data-${k}`)}=ok
      `,
      '<div data-a=ok></div><div data-b=ok></div><div data-c=ok></div>');
    });

    it("variable used in attr value", () => {
      expectHTML(p`
        - for v of ${["a", "b", "c"]}
          div data-foo=${ref("v")}
      `,
      '<div data-foo=a></div><div data-foo=b></div><div data-foo=c></div>');
    });

    it("variable used in tag name", () => {
      expectHTML(p`
        - for i of ${[1,2]}
          ${ref("i", (i) => ["a"+i, "b"+i, "c"+i])} ${ref("i", (i) => i)}
      `,
      '<a1>1</a1><b1>1</b1><c1>1</c1><a2>2</a2><b2>2</b2><c2>2</c2>');
    });
  });

  describe("ref", () => {
    it("reference @", () => {
      expectHTML(p`
        ${document.createElement("nav")} @elt
          | ${ref("@elt", (elt) => elt.tagName)}
      `,
      '<nav data-refname=elt>NAV</nav>');
    });

    it("retrieves multiple values", () => {
      expectHTML(p`
        - for x of ${[10,20]}
          - for y of ${[5,7]}
            output Area: ${ref(["x","y"], (x,y) => x*y)}
      `,
      '<output>Area: 50</output>' +
        '<output>Area: 70</output>' +
        '<output>Area: 100</output>' +
        '<output>Area: 140</output>'
      );

    });
  });

});
