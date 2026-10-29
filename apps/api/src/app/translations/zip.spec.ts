import { buildZip, crc32, readZip, zipSafeName, ZIP_LIMITS } from './zip';

// Structural parse of a store-only zip: local headers, central directory and
// EOCD must agree; entry bytes must round-trip exactly.
function parseZip(buf: Buffer) {
  expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50);
  const count = buf.readUInt16LE(buf.length - 12);
  const cdOffset = buf.readUInt32LE(buf.length - 6);
  const entries: { name: string; data: Buffer; crc: number }[] = [];
  let base = cdOffset;
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(base)).toBe(0x02014b50);
    const nameLen = buf.readUInt16LE(base + 28);
    const name = buf.subarray(base + 46, base + 46 + nameLen).toString('utf8');
    const crc = buf.readUInt32LE(base + 16);
    const size = buf.readUInt32LE(base + 20);
    const localOffset = buf.readUInt32LE(base + 42);
    expect(buf.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const data = buf.subarray(localOffset + 30 + localNameLen, localOffset + 30 + localNameLen + size);
    entries.push({ name, data, crc });
    // Next central record starts right after this name (no extra/comment).
    expect(buf.readUInt32LE(base + 46 + nameLen)).toBe(i + 1 < count ? 0x02014b50 : 0x06054b50);
    base = base + 46 + nameLen;
  }
  return entries;
}

describe('zip writer', () => {
  it('crc32 matches the standard test vector', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips entries byte-exactly with correct CRCs', () => {
    const a = Buffer.from('{"a":"b"}\n', 'utf8');
    const b = Buffer.from('msgid "x"\nmsgstr "y"\n', 'utf8');
    const entries = parseZip(buildZip([{ name: 'he.json', data: a }, { name: 'ar.po', data: b }]));
    expect(entries.map((e) => e.name)).toEqual(['he.json', 'ar.po']);
    expect(entries[0].data.equals(a)).toBe(true);
    expect(entries[1].data.equals(b)).toBe(true);
    expect(entries[0].crc).toBe(crc32(a));
    expect(entries[1].crc).toBe(crc32(b));
  });

  it('is deterministic: identical input produces identical bytes', () => {
    const entries = [{ name: 'he.json', data: Buffer.from('{}') }];
    expect(buildZip(entries).equals(buildZip(entries))).toBe(true);
  });

  it('handles UTF-8 names and empty entries', () => {
    const entries = parseZip(buildZip([{ name: 'עברית.json', data: Buffer.alloc(0) }]));
    expect(entries[0].name).toBe('עברית.json');
    expect(entries[0].data.length).toBe(0);
  });

  it('rejects duplicate names and over-limit archives', () => {
    expect(() => buildZip([{ name: 'a.json', data: Buffer.alloc(0) }, { name: 'a.json', data: Buffer.alloc(0) }])).toThrow('duplicate');
    const many = Array.from({ length: ZIP_LIMITS.MAX_ENTRIES + 1 }, (_, i) => ({ name: `f${i}`, data: Buffer.alloc(0) }));
    expect(() => buildZip(many)).toThrow('entry limit');
    expect(() => buildZip([{ name: 'big', data: Buffer.alloc(ZIP_LIMITS.MAX_BYTES + 1) }])).toThrow('size limit');
    // Overhead counts toward the budget: payloads just under the cap still
    // trip it once headers, names, central records and the EOCD are added.
    const near = ZIP_LIMITS.MAX_BYTES - 22 - 76 - 2 * 'a.json'.length + 1;
    expect(() => buildZip([{ name: 'a.json', data: Buffer.alloc(near) }])).toThrow('size limit');
    expect(buildZip([{ name: 'a.json', data: Buffer.alloc(near - 1) }]).length).toBe(ZIP_LIMITS.MAX_BYTES);
  });

  it('zipSafeName strips traversal and collapses unsafe characters', () => {
    expect(zipSafeName('../../etc/passwd')).toBe('etc-passwd');
    expect(zipSafeName('../../etc/passwd')).not.toContain('/');
    expect(zipSafeName('he')).toBe('he');
    expect(zipSafeName('zh-Hans-CN')).toBe('zh-Hans-CN');
    expect(zipSafeName('pt BR')).toBe('pt-BR');
    expect(zipSafeName('a/b\\c')).toBe('a-b-c');
    expect(zipSafeName('...')).toBe('file');
    expect(zipSafeName('')).toBe('file');
    expect(zipSafeName('/')).toBe('file');
  });
});

describe('zip reader (store-only subset)', () => {
  it('round-trips buildZip output byte-exactly', () => {
    const a = Buffer.from('{"k":"v"}\n');
    const b = Buffer.from('msgid "x"\nmsgstr "y"\n');
    const entries = readZip(buildZip([{ name: 'he.json', data: a }, { name: 'עברית.po', data: b }]));
    expect(entries.map((e) => e.name)).toEqual(['he.json', 'עברית.po']);
    expect(entries[0].data.equals(a)).toBe(true);
    expect(entries[1].data.equals(b)).toBe(true);
  });

  it('rejects a truncated archive and a CRC-tampered entry', () => {
    const zip = buildZip([{ name: 'he.json', data: Buffer.from('{"a":1}\n') }]);
    expect(() => readZip(zip.subarray(0, zip.length - 30))).toThrow('unsupported zip');
    const tampered = Buffer.from(zip);
    // First entry data starts at 30 + name length; flip one payload byte.
    tampered[30 + 'he.json'.length] ^= 0xff;
    expect(() => readZip(tampered)).toThrow('CRC mismatch');
  });

  it('rejects compressed (deflate) entries and data descriptors', () => {
    const zip = Buffer.from(buildZip([{ name: 'he.json', data: Buffer.from('x') }]));
    // Method lives at local+8 and central+10; set both to 8 (deflate).
    const deflated = Buffer.from(zip);
    deflated.writeUInt16LE(8, 8);
    deflated.writeUInt16LE(8, zip.length - 22 - (46 + 'he.json'.length) + 10 - (0)); // central record
    expect(() => readZip(deflated)).toThrow('store-only');
    const descriptor = Buffer.from(zip);
    descriptor.writeUInt16LE(descriptor.readUInt16LE(6) | 0x08, 6); // local flags
    const cdOff = zip.length - 22 - (46 + 'he.json'.length);
    descriptor.writeUInt16LE(descriptor.readUInt16LE(cdOff + 8) | 0x08, cdOff + 8);
    expect(() => readZip(descriptor)).toThrow('data descriptor');
  });

  it('rejects traversal and duplicate entry names', () => {
    const evil = buildZip([{ name: 'ok.json', data: Buffer.from('{}') }]);
    // Rewrite the only entry name to ../ok.json (same length bucket: 'ok' -> '..', keep 7 chars).
    const renamed = Buffer.from(evil);
    // Same-length rewrite of 'ok.json' to '../json' in both name fields.
    renamed[30] = 0x2e; renamed[31] = 0x2e; renamed[32] = 0x2f;
    const cdOff = evil.length - 22 - (46 + 'ok.json'.length);
    renamed[cdOff + 46] = 0x2e; renamed[cdOff + 47] = 0x2e; renamed[cdOff + 48] = 0x2f;
    expect(() => readZip(renamed)).toThrow('unsafe entry name');
    expect(() => readZip(buildZip([{ name: 'a.json', data: Buffer.alloc(0) }, { name: 'a.json', data: Buffer.alloc(0) }]))).toThrow();
  });
});
