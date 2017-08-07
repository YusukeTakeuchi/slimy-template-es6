/* Borrowed from Slm's test, but only a subset of it is included. */

/*
The MIT License

Copyright (c) 2014 - 2015 Slm Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const chai = require("chai");
const expect = chai.expect;
const {parse, expectHTML} = require("./helper");

function assertHtml(_, src, result, _)
{
  if (Array.isArray(src)) {
    src = src.join('\n');
  }

  const parsed = parse(src); // assume no interpolates
  expectHTML(parsed, result);
}
test = it;
notest = () => { }; // nop

describe('Html structure', function() {

  var template;

  test('simple render', function() {
    assertHtml(template, [
      'html',
      '  head',
      '    title Simple Test Title',
      '  body ',
      '    p Hello World, meet Slim.'
    ],
    '<html><head><title>Simple Test Title</title></head><body><p>Hello World, meet Slim.</p></body></html>',
    {});
  });

  test('relaxed indentation of first line', function() {
    assertHtml(template, [
      '  p',
      '    .content'
    ],
    '<p><div class=\"content\"></div></p>',
    {});
  });

  test('html tag with text and empty line', function() {
    assertHtml(template, [
      'p Hello',
      '',
      'p World'
    ],
    '<p>Hello</p><p>World</p>',
    {});
  });

  test('html namespaces', function() {
    assertHtml(template, [
      'html:body',
      '  html:p html:id="test" Text'
    ],
    '<html:body><html:p html:id="test">Text</html:p></html:body>',
    {});
  });

  // We don't support doctype
  notest('doctype', function() {
    assertHtml(template, [
      'doctype 1.1',
      'html'
    ],
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html></html>',
    {});
  });

  test('render with text block', function() {
    assertHtml(template, [
      'p',
      '  |',
      '   Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    ],
    '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>',
    {});
  });

  test('render with text block with subsequent markup', function() {
    assertHtml(template, [
      'p',
      '  |',
      '    Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'p Some more markup'
    ],
    '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><p>Some more markup</p>',
    {});
  });

  test('render with text block with subsequent markup', function() {
    assertHtml(template, [
      'p',
      '  |',
      '    Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'p Some more markup'
    ],
    '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><p>Some more markup</p>',
    {});
  });

  test('render with text block with trailing whitespace', function() {
    assertHtml(template, [
      '\' this is',
      '  a link to',
      'a href="link" page'
    ],
    'this is\na link to <a href="link">page</a>',
    {});
  });

  test('render with text block with trailing whitespace', function() {
    assertHtml(template, [
      'p',
      ' |',
      '  This is line one.',
      '   This is line two.',
      '    This is line three.',
      '     This is line four.',
      'p This is a new paragraph.'
    ],
    '<p>This is line one.\n This is line two.\n  This is line three.\n   This is line four.</p><p>This is a new paragraph.</p>',
    {});
  });

  test('nested text with nested html one same line', function() {
    assertHtml(template, [
      'p',
      ' | This is line one.',
      '    This is line two.',
      ' span.bold This is a bold line in the paragraph.',
      ' |  This is more content.'
    ],
    '<p>This is line one.\n This is line two.<span class="bold">This is a bold line in the paragraph.</span> This is more content.</p>',
    {});
  });

  test('nested text with nested html one same line 2', function() {
    assertHtml(template, [
      'p',
      ' |This is line one.',
      '   This is line two.',
      ' span.bold This is a bold line in the paragraph.',
      ' |  This is more content.'
    ],
    '<p>This is line one.\n This is line two.<span class="bold">This is a bold line in the paragraph.</span> This is more content.</p>',
    {});
  });

  test('nested text with nested html', function() {
    assertHtml(template, [
      'p',
      ' |',
      '  This is line one.',
      '   This is line two.',
      '    This is line three.',
      '     This is line four.',
      ' span.bold This is a bold line in the paragraph.',
      ' |  This is more content.'
    ],
    '<p>This is line one.\n This is line two.\n  This is line three.\n   This is line four.<span class="bold">This is a bold line in the paragraph.</span> This is more content.</p>',
    {});
  });

  test('simple paragraph with padding', function() {
    assertHtml(template, [
      'p    There will be 3 spaces in front of this line.'
    ],
    '<p>   There will be 3 spaces in front of this line.</p>',
    {});
  });

  // We don't follow the original behavior of indentation in an element.
  // The first line after the element indicator determines the indent.
  notest('paragraph with nested text', function() {
    assertHtml(template, [
      'p This is line one.',
      '   This is line two.'
    ],
    '<p>This is line one.\n This is line two.</p>',
    {});
  });

  // instead of above
  test('paragraph with nested text', function() {
    assertHtml(template, [
      'p This is line one.',
      '   This is line two.'
    ],
    '<p>This is line one.\nThis is line two.</p>',
    {});
  });

  // see above
  notest('paragraph with padded nested text', function() {
    assertHtml(template, [
      'p  This is line one.',
      '   This is line two.'
    ],
    '<p> This is line one.\n This is line two.</p>',
    {});
  });

  // instead of above
  test('paragraph with padded nested text', function() {
    assertHtml(template, [
      'p  This is line one.',
      '   This is line two.'
    ],
    '<p> This is line one.\nThis is line two.</p>',
    {});
  });

  test('labels with with br', function() {
    assertHtml(template, [
      'label',
      '  \' Название',
      '  input name="name" type="text" value=1',
      'br',
      '',
      'label',
      '  \' Название 2',
      '  input name="name" type="text" value=2'
    ],
    '<label>Название <input name="name" type="text" value="1" /></label><br /><label>Название 2 <input name="name" type="text" value="2" /></label>',
    {});
  });

  test('paragraph with attributes and nested text', function() {
    assertHtml(template, [
      'p#test class="paragraph" This is line one.',
      '                         This is line two.'
    ],
    '<p class="paragraph" id="test">This is line one.\nThis is line two.</p>',
    {});
  });

  test('multiline attributes with text on same line', function() {
    assertHtml(template, [
      'p[id="marvin"',
      '  class="martian"',
      ' data-info="Illudium Q-36"] THE space modulator'
    ],
    '<p class="martian" data-info="Illudium Q-36" id="marvin">THE space modulator</p>',
    {});
  });

  test('multiline attributes with nested text', function() {
    assertHtml(template, [
      'p(id="marvin"',
      '  class="martian"',
      'data-info="Illudium Q-36")',
      '  | THE space modulator'
    ],
    '<p class="martian" data-info="Illudium Q-36" id="marvin">THE space modulator</p>',
    {});
  });

  test('multiline attributes with nested text and extra indentation', function() {
    assertHtml(template, [
      'li( id="myid"',
      '    class="myclass"',
      'data-info="myinfo")',
      '  a href="link" My Link'
    ],
    '<li class="myclass" data-info="myinfo" id="myid"><a href="link">My Link</a></li>',
    {});
  });

  test('block expansion support', function() {
    assertHtml(template, [
      'ul',
      '  li.first: a href=\'a\' foo',
      '  li:       a href=\'b\' bar',
      '  li.last:  a href=\'c\' baz'
    ],
    '<ul><li class=\"first\"><a href=\"a\">foo</a></li><li><a href=\"b\">bar</a></li><li class=\"last\"><a href=\"c\">baz</a></li></ul>',
    {});
  });

  test('block expansion class attributes', function() {
    assertHtml(template, [
      '.a: .b: #c d'
    ],
    '<div class="a"><div class="b"><div id="c">d</div></div></div>',
    {});
  });

  test('block expansion nesting', function() {
    assertHtml(template, [
      'html: body: .content',
      '  | Text'
    ],
    '<html><body><div class=\"content\">Text</div></body></html>',
    {});
  });


  test('leading whitespace indicator on tag', function() {
    assertHtml(template, [
      'p< text'
    ],
    ' <p>text</p>',
    {});
  });

  test('trailing whitespace indicator on tag', function() {
    assertHtml(template, [
      'p> text'
    ],
    '<p>text</p> ',
    {});
  });

});
