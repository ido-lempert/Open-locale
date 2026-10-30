import { mergeFormsForSave, pluralCategories } from './plural-forms';

describe('pluralCategories', () => {
  it('returns CLDR categories from ICU', () => {
    expect(pluralCategories('en')).toEqual(['one', 'other']);
  });
  it('falls back to ["other"] for an invalid locale', () => {
    expect(pluralCategories('not a locale!!')).toEqual(['other']);
  });
});

describe('mergeFormsForSave', () => {
  it('sends edited text for browser-known categories', () => {
    expect(mergeFormsForSave({}, { one: '1 item', other: '# items' }, ['one', 'other']))
      .toEqual({ one: '1 item', other: '# items' });
  });
  it('preserves stored categories the browser ICU does not know', () => {
    // Server stored "many" (newer ICU); this browser only knows one/other.
    expect(mergeFormsForSave({ one: '1', other: '#', many: 'stored-many' }, { one: '2', other: '#' }, ['one', 'other']))
      .toEqual({ one: '2', other: '#', many: 'stored-many' });
  });
  it('fills never-stored browser categories with empty strings so "other" is present', () => {
    expect(mergeFormsForSave({}, {}, ['one', 'other'])).toEqual({ one: '', other: '' });
  });
  it('writes an intentional clear (empty string) over stored text', () => {
    expect(mergeFormsForSave({ one: '1', other: '#' }, { one: '', other: '#' }, ['one', 'other']))
      .toEqual({ one: '', other: '#' });
  });
});
