/** Where a zip entry's bytes are, how they are stored (0 stored, 8 deflated), and how large they are and say they become. */
interface ZipEntry {
  readonly method: number;
  readonly start: number;
  readonly size: number;
  readonly fullSize: number;
}

const END_RECORD = 0x06054b50;
const CENTRAL_RECORD = 0x02014b50;
const LOCAL_RECORD = 0x04034b50;

/** Where the end record is: in the last 22 bytes, or before a comment of at most 65,535 bytes; -1 for no zip. */
function endRecordAt(data: DataView): number {
  for (let at = data.byteLength - 22; at >= Math.max(0, data.byteLength - 65_557); at -= 1) {
    if (data.getUint32(at, true) === END_RECORD) return at;
  }
  return -1;
}

/** A zip archive's entries by name, from its central directory; null for bytes that are no zip archive. */
export function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> | null {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = endRecordAt(data);
  if (end < 0) return null;
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  let at = data.getUint32(end + 16, true);
  for (let count = data.getUint16(end + 10, true); count > 0; count -= 1) {
    if (at + 46 > bytes.length || data.getUint32(at, true) !== CENTRAL_RECORD) return null;
    const nameLength = data.getUint16(at + 28, true);
    const local = data.getUint32(at + 42, true);
    if (local + 30 > bytes.length || data.getUint32(local, true) !== LOCAL_RECORD) return null;
    entries.set(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)), {
      method: data.getUint16(at + 10, true),
      start: local + 30 + data.getUint16(local + 26, true) + data.getUint16(local + 28, true),
      size: data.getUint32(at + 20, true),
      fullSize: data.getUint32(at + 24, true),
    });
    at += 46 + nameLength + data.getUint16(at + 30, true) + data.getUint16(at + 32, true);
  }
  return entries;
}

/** Deflated bytes as they were, or null past `most` bytes, whatever the archive said they would come to. */
async function inflated(bytes: Uint8Array, most: number): Promise<Uint8Array | null> {
  // A copy, so the stream is handed bytes of a buffer of their own.
  const copy = new Uint8Array(bytes);
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.enqueue(copy); controller.close(); } });
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    total += read.value.length;
    if (total > most) {
      await reader.cancel();
      return null;
    }
    parts.push(read.value);
  }
  const out = new Uint8Array(total);
  parts.reduce((offset, part) => { out.set(part, offset); return offset + part.length; }, 0);
  return out;
}

/** A zip entry's text (UTF-8), stored or deflated; null when it is not there, is stored another way, or would pass `most` bytes. */
export async function zipText(bytes: Uint8Array, entries: ReadonlyMap<string, ZipEntry>, name: string, most: number): Promise<string | null> {
  const entry = entries.get(name);
  if (entry === undefined || entry.fullSize > most || entry.start + entry.size > bytes.length) return null;
  const raw = bytes.subarray(entry.start, entry.start + entry.size);
  const out = entry.method === 0 ? raw : entry.method === 8 ? await inflated(raw, most) : null;
  return out === null ? null : new TextDecoder().decode(out);
}
