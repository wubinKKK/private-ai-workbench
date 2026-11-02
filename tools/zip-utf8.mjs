import zlib from 'node:zlib';

/**
 * Minimal ZIP writer that always flags filenames as UTF-8.
 *
 * The r5 archive was produced by a manual "now zip the tree" step on Windows.
 * Whatever tool ran wrote the names in GBK and left general-purpose bit 11
 * (0x0800) clear, so macOS `unzip` read them as CP437 and destroyed six Chinese
 * filenames - `write error (disk full?)`, `fchmod ... Bad file descriptor`,
 * `is probably truncated`. Pure-ASCII names were unaffected, which is exactly
 * why the build reported success.
 *
 * The fix is not a fallback extractor in the documentation. It is to stop
 * emitting a broken archive: the build writes the zip itself, sets bit 11 on
 * every entry, and never asks a shell tool what encoding it prefers.
 *
 * Deliberately dependency-free and deterministic - a fixed timestamp means the
 * same staged tree always produces the same bytes, so the archive's own sha256
 * is something the recipient can be told in advance.
 */

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
/** Bit 11. Without it the reader falls back to CP437 and mangles every
 *  non-ASCII name. This is the whole point of this module. */
export const UTF8_NAME_FLAG = 0x0800;
/** Version-made-by 3 (Unix) in the high byte, so external attributes carry the
 *  file mode and an extracted .sh keeps its executable bit on macOS. */
const VERSION_MADE_BY_UNIX = 0x031e;
const VERSION_NEEDED = 20;
const MAX_UINT32 = 0xffff_ffff;
const MAX_UINT16 = 0xffff;

/** Fixed so a rebuild of an unchanged tree is byte-identical. 2026-01-01T00:00:00. */
export const FIXED_DOS_TIME = 0;
export const FIXED_DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value;
  }
  return table;
})();

export function crc32(buffer) {
  // Node 20.15+ ships zlib.crc32. Fall back rather than require a floor bump.
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buffer) >>> 0;
  let crc = -1;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/**
 * @param entries {Array<{name: string, data: Buffer, mode?: number}>}
 *   `name` is a POSIX path. Backslashes are rejected: a zip stores forward
 *   slashes, and a name with a backslash extracts as one flat weirdly-named file
 *   on POSIX instead of a directory tree.
 */
export function writeZip(entries) {
  if (entries.length > MAX_UINT16) {
    throw new Error(`${entries.length} entries needs Zip64, which this writer does not emit`);
  }
  const seen = new Set();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name.includes('\\')) throw new Error(`entry name must use forward slashes: ${entry.name}`);
    if (entry.name.startsWith('/') || entry.name.includes('..')) throw new Error(`entry name must be relative and contained: ${entry.name}`);
    if (seen.has(entry.name)) throw new Error(`duplicate entry: ${entry.name}`);
    seen.add(entry.name);

    const name = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    if (raw.length > MAX_UINT32) throw new Error(`${entry.name} needs Zip64`);
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    // Storing is smaller for already-compressed or tiny files. Picking the
    // smaller of the two is what a real archiver does.
    const stored = deflated.length >= raw.length;
    const body = stored ? raw : deflated;
    const method = stored ? 0 : 8;
    const crc = crc32(raw);
    const mode = entry.mode ?? 0o644;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIG, 0);
    local.writeUInt16LE(VERSION_NEEDED, 4);
    local.writeUInt16LE(UTF8_NAME_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(FIXED_DOS_TIME, 10);
    local.writeUInt16LE(FIXED_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIG, 0);
    central.writeUInt16LE(VERSION_MADE_BY_UNIX, 4);
    central.writeUInt16LE(VERSION_NEEDED, 6);
    central.writeUInt16LE(UTF8_NAME_FLAG, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(FIXED_DOS_TIME, 12);
    central.writeUInt16LE(FIXED_DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    // Regular file (0o100000) plus mode, in the high 16 bits. `>>> 0` because
    // JS shifts are signed: 0o100644 << 16 is negative as an int32, which
    // writeUInt32LE rejects outright.
    central.writeUInt32LE((((0o100000 | mode) & MAX_UINT16) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
    if (offset > MAX_UINT32) throw new Error('archive exceeds 4 GiB and needs Zip64');
  }

  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuffer, eocd]);
}

/** Read back the UTF-8 flag and names, so the build can assert its own output
 *  rather than trust that it set the bit. */
export function readZipNames(archive) {
  const eocdAt = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdAt < 0) throw new Error('not a zip: no end-of-central-directory record');
  const count = archive.readUInt16LE(eocdAt + 10);
  let at = archive.readUInt32LE(eocdAt + 16);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(at) !== CENTRAL_SIG) throw new Error(`central directory entry ${index} is malformed`);
    const flags = archive.readUInt16LE(at + 8);
    const nameLength = archive.readUInt16LE(at + 28);
    const extraLength = archive.readUInt16LE(at + 30);
    const commentLength = archive.readUInt16LE(at + 32);
    names.push({
      name: archive.subarray(at + 46, at + 46 + nameLength).toString('utf8'),
      utf8Flagged: (flags & UTF8_NAME_FLAG) !== 0,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
