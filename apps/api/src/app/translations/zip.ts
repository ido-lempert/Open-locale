// Store-only ZIP writer: no compression, no external dependency. Entry
// contents are the exact bytes of the per-locale export endpoints, so a
// bundle entry is byte-equal to its single-locale counterpart. Limits are
// enforced while building: at most MAX_ENTRIES entries and MAX_BYTES total
// archive bytes counting full overhead (each entry's local header, name and
// central record, plus the EOCD - store-only, so compressed == uncompressed
// for the data itself); exceeding either throws before any bytes are
// returned. Fixed DOS date keeps output deterministic.

const MAX_ENTRIES = 256;
const MAX_BYTES = 32 * 1024 * 1024;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Filename-safe segment: letters, digits, dot, dash, underscore kept;
// anything else (including path separators) collapses to a dash. Empty or
// all-collapsed names fall back to 'file', so no entry name can contain a
// path or be empty.
export function zipSafeName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').replace(/-+$/g, '');
  return cleaned.length > 0 && cleaned !== '.' && cleaned !== '..' ? cleaned : 'file';
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

// Fixed DOS timestamp: 2024-01-01 00:00:00.
const DOS_TIME = 0;
const DOS_DATE = (44 << 9) | (1 << 5) | 1;

export function buildZip(entries: ZipEntry[]): Buffer {
  if (entries.length > MAX_ENTRIES) throw new Error(`zip entry limit exceeded (${entries.length} > ${MAX_ENTRIES})`);
  // Budget the whole archive, not just the payloads: 30-byte local header +
  // name + 46-byte central record + name per entry, 22-byte EOCD once.
  let total = 22;
  for (const e of entries) {
    total += e.data.length + 76 + 2 * Buffer.byteLength(e.name, 'utf8');
    if (total > MAX_BYTES) throw new Error(`zip size limit exceeded (${MAX_BYTES} bytes including overhead)`);
  }
  const names = new Set<string>();
  for (const e of entries) {
    if (names.has(e.name)) throw new Error(`duplicate zip entry name: ${e.name}`);
    names.add(e.name);
  }

  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // no extra
    chunks.push(local, nameBuf, e.data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); // version made by
    cen.writeUInt16LE(20, 6); // version needed
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(e.data.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42); // local header offset
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + e.data.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

export const ZIP_LIMITS = { MAX_ENTRIES, MAX_BYTES };
