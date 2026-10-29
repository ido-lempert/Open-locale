import { toTmx } from './tmx';

describe('TMX export', () => {
  it('emits a 1.4 header with the source language and one tu per pair', () => {
    const out = toTmx([['Welcome', 'ברוכים הבאים'], ['Cart', 'עגלה']], 'en', 'he');
    expect(out).toContain('<tmx version="1.4">');
    expect(out).toContain('srclang="en"');
    expect(out).toContain('<tuv xml:lang="en"><seg>Welcome</seg></tuv>');
    expect(out).toContain('<tuv xml:lang="he"><seg>ברוכים הבאים</seg></tuv>');
    expect(out.match(/<tu>/g)).toHaveLength(2);
  });

  it('escapes markup and quotes in segments', () => {
    const out = toTmx([['A & B <C>', 'say "hi"']], 'en', 'he');
    expect(out).toContain('<seg>A &amp; B &lt;C&gt;</seg>');
    expect(out).toContain('<seg>say "hi"</seg>');
    expect(out).not.toContain('<seg>A & B</seg>');
  });

  it('emits an empty body for no entries', () => {
    const out = toTmx([], 'en', 'fr');
    expect(out).toContain('<body>\n\n  </body>');
    expect(out).toContain('srclang="en"');
  });
});
