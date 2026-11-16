/**
 * Just enough XML to read DigiLocker's documents (decision 0676): one element's attributes and text, by its name. The
 * documents are machine-written, so a reader of tags serves. Their signature is not checked: RIVR trusts the webhook by its
 * per-session key, and the document came from Zoop over TLS.
 */

/** An element as read: its attributes, decoded, and its text (only meaningful for an element with no children). */
export interface XmlElement {
  readonly attributes: ReadonlyMap<string, string>;
  readonly text: string;
}

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** XML's character references and its five named ones, as text; any other is left as it is. */
export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-z]{2,4});/g, (whole, name: string) => {
    const code = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : name.startsWith('#') ? Number(name.slice(1)) : null;
    if (code === null) return NAMED[name] ?? whole;
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/** The first element named `name` (a fixed name, never one from a document), or null when there is none. */
export function xmlElement(xml: string, name: string): XmlElement | null {
  const open = new RegExp(`<${name}((?:\\s+[\\w:.-]+\\s*=\\s*(?:"[^"]*"|'[^']*'))*)\\s*(/?)>`).exec(xml);
  if (open === null) return null;
  const attributes = new Map<string, string>();
  for (const pair of (open[1] ?? '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes.set(pair[1] ?? '', decodeXml(pair[2] ?? pair[3] ?? ''));
  }
  if (open[2] === '/') return { attributes, text: '' };
  const start = open.index + open[0].length;
  const end = xml.indexOf(`</${name}>`, start);
  return { attributes, text: end < 0 ? '' : decodeXml(xml.slice(start, end).trim()) };
}
