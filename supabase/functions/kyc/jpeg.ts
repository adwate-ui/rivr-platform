// The selfie as stored: a whole JPEG with its metadata removed. The app already sends a photo it
// re-encoded; this holds for any other caller, whose photo might carry EXIF, GPS among it.

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;

function byteAt(bytes: Uint8Array, at: number): number {
  return bytes[at] ?? 0;
}

/** Starts with the start-of-image marker and ends with the end-of-image one. */
function isWhole(bytes: Uint8Array): boolean {
  const last = bytes.length - 1;
  return byteAt(bytes, 0) === 0xff && byteAt(bytes, 1) === SOI && byteAt(bytes, last - 1) === 0xff && byteAt(bytes, last) === EOI;
}

/** A segment before the start of scan begins at `at`. */
function isSegment(bytes: Uint8Array, at: number): boolean {
  return at + 4 <= bytes.length && byteAt(bytes, at) === 0xff && byteAt(bytes, at + 1) !== SOS;
}

/** APP1 to APP15 (EXIF, XMP and the like) and comments carry metadata; every other segment is the image. */
function isMetadata(marker: number): boolean {
  return (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
}

function joined(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const whole = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of parts) {
    whole.set(part, at);
    at += part.length;
  }
  return whole;
}

/** The JPEG without its metadata segments, or null if it is not a whole JPEG. */
export function cleanJpeg(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> | null {
  if (!isWhole(bytes)) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let at = 2;
  // Segments run marker by marker up to the start of scan; the image data follows it to the end.
  while (isSegment(bytes, at)) {
    const end = at + 2 + ((byteAt(bytes, at + 2) << 8) | byteAt(bytes, at + 3));
    if (!isMetadata(byteAt(bytes, at + 1))) parts.push(bytes.subarray(at, end));
    at = end;
  }
  if (byteAt(bytes, at) !== 0xff || byteAt(bytes, at + 1) !== SOS) return null;
  parts.push(bytes.subarray(at));
  return joined(parts);
}
