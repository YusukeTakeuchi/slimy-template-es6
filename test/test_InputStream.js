const chai = require("chai");
const should = chai.should();
const expect = chai.expect;
const InputStream = require("../src/inputstream.js");

describe("InputStream", () => {
  describe("#consume()", () => {
    it("should return matchdata", () => {
      const is = InputStream.tag`abc deg`;
      const md = is.consume(/^(\w+)\s*(\w+)/);
      md.should.be.a("array");
      md.should.have.property(0, "abc deg");
      md.should.have.property(1, "abc");
      md.should.have.property(2, "deg");
    });

    it("should fail for matches to the middle of the string", () => {
      const is = InputStream.tag`AAA xyz`;
      (() => is.consume(/xyz/)).should.throw();
    });

    it("should advance stream", () => {
      const is = InputStream.tag`___ ---- @@@@`;
      is.consume(/^_+/).should.be.a("array");
      expect(is.consume(/^_+/)).to.be.null;
    });
  });

  describe("#consumeMatchd()", () => {
    it("should return string", () => {
      const is = InputStream.tag`ABC`;
      is.consumeMatched(/^A/).should.equal("A");
    });
  });

  describe("#consumeCaptured()", () => {
    it("should return nth capture", () => {
      const is = InputStream.tag`1XXX 2YYY 3ZZZ`;
      is.consumeCaptured(/^(\d\w+) (\d\w+) (\d\w+)/, 2).should.equal("2YYY");
    });

    it("should return first capture by default", () => {
      const is = InputStream.tag`1XXX 2YYY 3ZZZ`;
      is.consumeCaptured(/^(\d\w+) (\d\w+) (\d\w+)/).should.equal("1XXX");
    });
  });

  describe("#consumeInterpolate()", () => {
    it("should return an wrapped object of passed interpolation", () => {
      const is = InputStream.tag`abc${5+2}deg`;
      is.consume(/^abc/);
      is.consumeInterpolate().should.deep.equal({value: 7});
    });

    it("should return null if the previous segment remains", () => {
      const is = InputStream.tag`111111222222 ${333333}`;
      is.consume(/^1+/);
      expect(is.consumeInterpolate()).to.be.null;
    });

    it("should not change segment on no interpolate", () => {
      const is = InputStream.tag`111111222222`;
      is.consume(/^1+/);
      expect( () => is.consumeInterpolate()).not.to.change( () => is.currentSegment);
    });
  });

  describe("#consumeString()", () => {
    it("should advance if matched", () => {
      const is = InputStream.tag`abc_123_xyz`;
      is.consumeString("abc_");
      expect(is.consumeString("123")).to.equal("123");
    });

    it("should work for unicode characters", () => {
      const is = InputStream.tag`あかさたな_はまやらわ`;
      is.consumeString("あかさたな_");
      expect(is.consumeString("はまやらわ")).to.equal("はまやらわ");
    });
  });

  describe("#isEof()", () => {
    it("should be true on EOF", () => {
      const is = InputStream.tag`111 222 ${333} 444`;
      is.consume(/^.*/);
      is.consumeInterpolate();
      is.consume(/^\s+/);
      is.consume(/^\d+/);
      is.isEoF().should.be.true;
    });
  });

  describe("#tryParse()", () => {
    it("should keep its state unchanged on failure", () => {
      const is = InputStream.tag`foo bar baz`;
      expect( () => {
        is.tryParse( (tryIs) => {
          return tryIs.consume(/^foo\s*/) &&
                  tryIs.consume(/^baz\s*/) &&
                  tryIs.consume(/^\w+/);
        });
      }).not.to.change( () => is.currentSegment );

      const is2 = InputStream.tag`foo ${3} baz`;
      expect( () => {
        is2.tryParse( (tryIs) => {
          tryIs.consume(/^foo\s*/);
          tryIs.consumeInterpolate();
          return tryIs.consume(/^222/);
        });
      }).not.to.change( () => is2.currentSegment );
    });

    it("should update its state on success", () => {
      const is = InputStream.tag`foo bar baz`;
      is.tryParse( (tryIs) => {
        tryIs.consume(/^foo\s*/);
        tryIs.consume(/^bar\s*/);
        return true;
      });
      is.currentSegment.should.equal("baz");

      const is2 = InputStream.tag`foo ${is} baz`;
      is2.tryParse( (tryIs) => {
        tryIs.consume(/^foo\s*/);
        tryIs.consumeInterpolate();
        tryIs.consume(/^\s*/);
        return true;
      });
      is2.currentSegment.should.equal("baz");
    });

    it("should return callback's result", () => {
      const is = InputStream.tag`aaaaa___bbb`;
      is.tryParse( (tryIs) => {
        return tryIs.consumeMatched(/^a*/);
      }).should.equal("aaaaa");
      expect(is.tryParse(() => (null))).to.be.null;
    });
  });

});
