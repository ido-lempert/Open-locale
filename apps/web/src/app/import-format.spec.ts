import { detectImportFormat } from './import-format';

describe('detectImportFormat', () => {
  it('maps every supported extension', () => {
    expect(detectImportFormat('en.json')).toBe('json');
    expect(detectImportFormat('de.CSV')).toBe('csv');
    expect(detectImportFormat('strings.xml')).toBe('android');
    expect(detectImportFormat('Localizable.strings')).toBe('ios');
    expect(detectImportFormat('app.po')).toBe('po');
    expect(detectImportFormat('app.xlf')).toBe('xliff');
    expect(detectImportFormat('app.xliff')).toBe('xliff');
    expect(detectImportFormat('messages.properties')).toBe('properties');
    expect(detectImportFormat('app_en.arb')).toBe('arb');
    expect(detectImportFormat('en.yaml')).toBe('yaml');
    expect(detectImportFormat('en.yml')).toBe('yaml');
    expect(detectImportFormat('Strings.resx')).toBe('resx');
  });

  it('returns null for unknown or missing extensions', () => {
    expect(detectImportFormat('notes.txt')).toBeNull();
    expect(detectImportFormat('Makefile')).toBeNull();
    expect(detectImportFormat('.po')).toBeNull();
    expect(detectImportFormat('archive.')).toBeNull();
  });

  it('uses the basename only and is case-insensitive', () => {
    expect(detectImportFormat('/tmp/dir/sub/en.YAML')).toBe('yaml');
    expect(detectImportFormat('C:\\locales\\app.PO')).toBe('po');
  });
});
