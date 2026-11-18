// Zero-dependency standard ZIP archive builder for browser & Node.
// Creates clean, uncompressed (STORE method) ZIP files compatible with Windows, Mac, Linux, 7-Zip, Python, etc.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function computeCrc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

/**
 * Normalizes an entry's data into Uint8Array
 */
async function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return encoder.encode(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const ab = await data.arrayBuffer();
    return new Uint8Array(ab);
  }
  return new Uint8Array(0);
}

/**
 * Creates a standard ZIP archive from a list of files.
 * @param {Array<{ path: string, data: Uint8Array|ArrayBuffer|string|Blob }>} files
 * @returns {Promise<Uint8Array>}
 */
export async function buildZip(files) {
  const entries = [];
  let localHeadersSize = 0;

  for (const file of files) {
    const rawPath = (file.path || file.name || 'file').replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBytes = encoder.encode(rawPath);
    const dataBytes = await toUint8Array(file.data);
    const crc = computeCrc32(dataBytes);

    entries.push({
      path: rawPath,
      nameBytes,
      dataBytes,
      crc,
      offset: localHeadersSize,
    });

    // 30 bytes fixed local header + name length + data length
    localHeadersSize += 30 + nameBytes.length + dataBytes.length;
  }

  let centralDirSize = 0;
  for (const entry of entries) {
    // 46 bytes fixed central dir header + name length
    centralDirSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localHeadersSize + centralDirSize + 22; // 22 bytes EOCD
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  let p = 0;

  // 1. Write Local Headers & File Data
  for (const entry of entries) {
    // Signature: 0x04034b50
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true); // version needed (2.0)
    view.setUint16(p + 6, 0x0800, true); // bit flag: UTF-8 filenames
    view.setUint16(p + 8, 0, true); // compression: 0 = STORE
    view.setUint16(p + 10, 0, true); // mod time
    view.setUint16(p + 12, 0, true); // mod date
    view.setUint32(p + 14, entry.crc, true); // crc-32
    view.setUint32(p + 18, entry.dataBytes.length, true); // compressed size
    view.setUint32(p + 22, entry.dataBytes.length, true); // uncompressed size
    view.setUint16(p + 26, entry.nameBytes.length, true); // filename length
    view.setUint16(p + 28, 0, true); // extra field length
    p += 30;

    buf.set(entry.nameBytes, p);
    p += entry.nameBytes.length;

    buf.set(entry.dataBytes, p);
    p += entry.dataBytes.length;
  }

  const centralDirStartOffset = p;

  // 2. Write Central Directory Headers
  for (const entry of entries) {
    // Signature: 0x02014b50
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true); // version made by
    view.setUint16(p + 6, 20, true); // version needed
    view.setUint16(p + 8, 0x0800, true); // bit flag: UTF-8
    view.setUint16(p + 10, 0, true); // compression: STORE
    view.setUint16(p + 12, 0, true); // mod time
    view.setUint16(p + 14, 0, true); // mod date
    view.setUint32(p + 16, entry.crc, true); // crc-32
    view.setUint32(p + 20, entry.dataBytes.length, true); // compressed size
    view.setUint32(p + 24, entry.dataBytes.length, true); // uncompressed size
    view.setUint16(p + 28, entry.nameBytes.length, true); // filename length
    view.setUint16(p + 30, 0, true); // extra length
    view.setUint16(p + 32, 0, true); // comment length
    view.setUint16(p + 34, 0, true); // disk start
    view.setUint16(p + 36, 0, true); // internal file attributes
    view.setUint32(p + 38, 0, true); // external file attributes
    view.setUint32(p + 42, entry.offset, true); // relative offset of local header
    p += 46;

    buf.set(entry.nameBytes, p);
    p += entry.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  // Signature: 0x06054b50
  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 4, 0, true); // disk number
  view.setUint16(p + 6, 0, true); // disk start
  view.setUint16(p + 8, entries.length, true); // entries on this disk
  view.setUint16(p + 10, entries.length, true); // total entries
  view.setUint32(p + 12, centralDirSize, true); // size of central directory
  view.setUint32(p + 16, centralDirStartOffset, true); // offset of central directory
  view.setUint16(p + 20, 0, true); // zip comment length

  return buf;
}

/**
 * Triggers a download of a ZIP blob in browser
 */
export function downloadZipBlob(zipBytes, filename = 'archive.zip') {
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
