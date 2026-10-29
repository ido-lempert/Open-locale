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

// Store-only ZIP reader, the exact inverse of buildZip: archives produced by
// the export bundle, or byte-compatible ones. The subset is deliberate and
// every deviation is rejected: EOCD must sit at len-22 (no archive comment),
// single disk, no ZIP64 markers, method 0 (store) only, no data descriptors,
// compressed size == uncompressed size, CRC32 verified per entry. The same
// MAX_ENTRIES / MAX_BYTES budgets as the writer apply, with full overhead
// accounted. Anything outside the subset throws before a caller sees entries.
export function readZip(buf: Buffer): ZipEntry[] {
  const fail = (reason: string): never => { throw new Error(`unsupported zip: ${reason}`); };
  if (buf.length < 22) fail('too small');
  const eocd = buf.length - 22;
  if (buf.readUInt32LE(eocd) !== 0x06054b50) fail('no end-of-central-directory at the expected offset');
  if (buf.readUInt16LE(eocd + 4) !== 0 || buf.readUInt16LE(eocd + 6) !== 0) fail('multi-disk archive');
  const count = buf.readUInt16LE(eocd + 10);
  if (count !== buf.readUInt16LE(eocd + 8)) fail('disk entry count differs from total');
  if (count > MAX_ENTRIES) fail(`entry limit exceeded (${count} > ${MAX_ENTRIES})`);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) fail('ZIP64');
  if (cdOffset + cdSize !== eocd) fail('central directory does not abut the EOCD');
  // Pass 1: validate every central record AND its local header, and require
  // them to agree on flags, method, CRC, sizes and the name bytes - a
  // central/local disagreement is a hostile-construction signal, so the
  // archive is rejected rather than resolved in either direction's favor.
  interface Pending { name: string; start: number; end: number; crc: number }
  const pending: Pending[] = [];
  const names = new Set<string>();
  let total = 22;
  let off = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) fail('bad central record');
    const flags = buf.readUInt16LE(off + 8);
    if (flags & 0x08) fail('data descriptor');
    const method = buf.readUInt16LE(off + 10);
    if (method !== 0) fail(`compression method ${method} (store-only subset)`);
    const crc = buf.readUInt32LE(off + 16);
    const compressed = buf.readUInt32LE(off + 20);
    const size = buf.readUInt32LE(off + 24);
    if (compressed === 0xffffffff || size === 0xffffffff) fail('ZIP64');
    if (compressed !== size) fail('compressed size differs from uncompressed');
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    if (local + 30 > cdOffset || buf.readUInt32LE(local) !== 0x04034b50) fail('bad local header');
    const localNameLen = buf.readUInt16LE(local + 26);
    const localExtraLen = buf.readUInt16LE(local + 28);
    if (buf.readUInt16LE(local + 6) !== flags || buf.readUInt16LE(local + 8) !== method) fail('central/local header disagree (flags/method)');
    if (buf.readUInt32LE(local + 14) !== crc || buf.readUInt32LE(local + 18) !== compressed || buf.readUInt32LE(local + 22) !== size) fail('central/local header disagree (crc/sizes)');
    if (localNameLen !== nameLen || !buf.subarray(local + 30, local + 30 + nameLen).equals(buf.subarray(off + 46, off + 46 + nameLen))) fail('central/local header disagree (name)');
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    if (name.length === 0 || name.includes('\\') || name.split('/').some((seg) => seg === '..')) fail(`unsafe entry name ${JSON.stringify(name)}`);
    if (names.has(name)) fail(`duplicate entry name ${JSON.stringify(name)}`);
    names.add(name);
    const dataStart = local + 30 + localNameLen + localExtraLen;
    if (dataStart + size > cdOffset) fail('entry data overlaps the central directory');
    total += size + 76 + 2 * nameLen;
    if (total > MAX_BYTES) fail(`size limit exceeded (${MAX_BYTES} bytes including overhead)`);
    pending.push({ name, start: dataStart, end: dataStart + size, crc });
    off += 46 + nameLen + extraLen + commentLen;
  }
  // Entry data ranges must be pairwise disjoint: an overlapping offset would
  // let one payload masquerade as two entries.
  const byStart = [...pending].sort((a, b) => a.start - b.start);
  for (let i = 1; i < byStart.length; i++) {
    if (byStart[i].start < byStart[i - 1].end) fail(`entry data ranges overlap (${JSON.stringify(byStart[i - 1].name)} / ${JSON.stringify(byStart[i].name)})`);
  }
  // Pass 2: extract and verify.
  const out: ZipEntry[] = [];
  for (const e of pending) {
    const data = buf.subarray(e.start, e.end);
    if (crc32(data) !== e.crc) fail(`CRC mismatch on ${JSON.stringify(e.name)}`);
    out.push({ name: e.name, data: Buffer.from(data) });
  }
  return out;
}
