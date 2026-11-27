import { matchesIfNoneMatch } from './ota-etag';

describe('OTA conditional validator', () => {
  const current = 'W/"bundle"';
  it.each([
    ['weak', current], ['strong', '"bundle"'], ['wildcard', '*'],
    ['wildcard whitespace', ' \t* \t'],
    ['first', `${current}, "other"`], ['last', `"other", ${current}`],
    ['empty list members', `, , ${current},,`],
    ['quoted comma before matching tag', `"other,tag", ${current}`],
  ])('matches %s', (_label, value) => expect(matchesIfNoneMatch(value, current)).toBe(true));
  it.each([
    ['absent', undefined], ['empty', ''], ['empty members', ', ,'],
    ['other', '"other"'], ['substring', '"prefixbundlesuffix"'],
    ['case differs', 'W/"Bundle"'], ['lowercase weak prefix', 'w/"bundle"'],
    ['missing closing quote', 'W/"bundle'], ['missing opening quote', 'W/bundle"'],
    ['trailing garbage', `${current} garbage`],
    ['prefix garbage', `garbage ${current}`], ['wildcard list', `*, ${current}`],
    ['wildcard twice', '*,*'], ['missing comma', `"other" ${current}`],
    ['quoted comma containing tag', '"other,bundle"'],
    ['non-HTTP whitespace', '\u00a0*'],
    ['newline after tag', `${current}\n`], ['newline after wildcard', '*\n'],
  ])('rejects %s', (_label, value) => expect(matchesIfNoneMatch(value, current)).toBe(false));
  it('compares whole opaque values containing commas', () => {
    expect(matchesIfNoneMatch('"a,b"', 'W/"a,b"')).toBe(true);
    expect(matchesIfNoneMatch('"a", "b"', 'W/"a,b"')).toBe(false);
  });
  it('does not retain state across repeated matches', () => {
    for (let i = 0; i < 3; i++) expect(matchesIfNoneMatch(current, current)).toBe(true);
  });
});
