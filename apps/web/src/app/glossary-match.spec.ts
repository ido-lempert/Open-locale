import { hintsForTarget, termInText } from './glossary-match';

describe('termInText', () => {
  it('matches ASCII terms with word boundaries', () => {
    expect(termInText('Welcome', 'Welcome to the shop')).toBe(true);
    expect(termInText('come', 'Welcome to the shop')).toBe(false);
  });
  it('matches Hebrew terms without false partial matches', () => {
    expect(termInText('ברוכים', 'ברוכים הבאים לחנות')).toBe(true);
    expect(termInText('ברוכים', 'ברוכיםהבאים')).toBe(false);
    expect(termInText('ברו', 'ברוכים הבאים')).toBe(false);
  });
  it('matches Arabic terms without false partial matches', () => {
    expect(termInText('مرحبا', 'مرحبا بكم في المتجر')).toBe(true);
    expect(termInText('مرح', 'مرحبا بكم')).toBe(false);
  });
  it('handles regex-special terms literally', () => {
    expect(termInText('C++', 'Ship with C++ support')).toBe(true);
    expect(termInText('price (USD)', 'Total price (USD) shown')).toBe(true);
    expect(termInText('a.b', 'literal a.b here')).toBe(true);
    expect(termInText('a.b', 'aXb should not match')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(termInText('checkout', 'Go to Checkout now')).toBe(true);
  });
});

describe('hintsForTarget', () => {
  const terms = [
    { term: 'Welcome', notes: '', doNotTranslate: false, translations: { he: 'ברוכים' } },
    { term: 'Open-locale', notes: 'brand', doNotTranslate: true, translations: {} },
  ];
  it('labels each hint with its target locale and translation', () => {
    const hints = hintsForTarget('Welcome to Open-locale', 'he', terms);
    expect(hints).toEqual([
      { term: 'Welcome', locale: 'he', value: 'ברוכים', notes: '' },
      { term: 'Open-locale', locale: 'he', value: 'keep as-is', notes: 'brand' },
    ]);
  });
  it('reports missing translations per target locale', () => {
    const hints = hintsForTarget('Welcome to Open-locale', 'ar', terms);
    expect(hints[0]).toEqual({ term: 'Welcome', locale: 'ar', value: '(no translation)', notes: '' });
  });
  it('returns nothing when no term matches the source', () => {
    expect(hintsForTarget(' unrelated text ', 'he', terms)).toEqual([]);
  });
});
