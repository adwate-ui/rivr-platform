import type { Breadcrumb, Event as SentryEvent, Exception, StackFrame } from '@sentry/react';

// What an error may carry out of the app (decision 0604). The apps hold phone numbers, PAN and Aadhaar numbers and
// sign-in tokens; none may reach Sentry. A name cannot be told from other words, so nothing made to hold one is kept
// (no user, no page text, no console line, no typed input) and the places an error's own words quote one are cut.

/** What is being sent: an error; a `value` thrown or rejected that was not an error, whose words are any words at all; or a failure a screen `handled`. */
export type EventKind = 'error' | 'value' | 'handled';

// Longer than any error's words that say something; the rules below then cost a fixed amount, whatever is thrown.
const LONGEST = 2000;
// What may stand between the digits of one number, or the parts of a PAN: spaces, dots, commas, slashes, brackets,
// underscores and dashes of every kind.
const BETWEEN = String.raw`[\s.,/()_\p{Pd}]`;

// In this order: what is cut whole goes first, and a PAN is named before its digits go.
const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  // A query string or fragment, on an address or a path: it carries filters, codes and tokens.
  [/(\S)[?#]\S+/g, '$1'],
  // A photo or file written out as text.
  [/\bdata:\S+/gi, '[data]'],
  // What was thrown or rejected when that was not an error, as the SDK words it: any words at all.
  [/(captured (?:with value:|as exception with message) )[\s\S]*/, '$1[value]'],
  // What the database quotes back when it refuses a row: the row itself, or Key (full_name)=(Asha Verma).
  [/(Failing row contains )\(.*/g, '$1[row]'],
  [/=\(.*/g, '=([value])'],
  // A sign-in token (a JWT), a row's id, then any other long run of letters and digits: a key or a hash.
  [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[token]'],
  [/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '[id]'],
  [/[\w+=-]{32,}/g, '[token]'],
  // An email address, its @ written out or as an address carries it. Bounded, so a long run of dots costs nothing.
  [/[\w.+-]{1,64}(?:@|%40)[\w.-]{1,255}/gi, '[email]'],
  // A PAN: five letters, four digits, a letter. Joined to other words, or standing alone with its parts spaced.
  [/[a-z]{5}\d{4}[a-z]/gi, '[pan]'],
  [new RegExp(String.raw`(^|[^a-z])[a-z]{5}${BETWEEN}?\d{4}${BETWEEN}?[a-z](?![a-z])`, 'giu'), '$1[pan]'],
  // Four digits or more in any script, however they are spaced: a phone number, an Aadhaar number, a sign-in code, an amount.
  [new RegExp(String.raw`\+?\p{Nd}(?:${BETWEEN}{0,4}\p{Nd}){3,}`, 'gu'), '[number]'],
];

// The database names its own things in quotes: relation "member", constraint "member_phone_check". Those stay, as they are
// how a fault is found; any other quoted words may be a value given back, "Asha Verma" is not valid JSON, and go.
const NAMES_ITS_OWN = /\b(?:relation|table|column|constraint|index|function|type|schema|role|policy|trigger|view|sequence|operator) $/i;

function withoutQuotedWords(text: string): string {
  const withoutDouble = text.replace(/"([^"]*)"/g, (quoted, words: string, at: number) =>
    (/^[a-z0-9_.]+$/.test(words) && NAMES_ITS_OWN.test(text.slice(Math.max(0, at - 12), at)) ? quoted : '"[text]"'));
  // In single quotes or backticks a browser names a part of the code (reading 'map'); one word stays, more than one goes.
  return withoutDouble.replace(/(['`])([^'`]*)\1/g, (quoted, mark: string, words: string) => (/^[\w$.-]{1,40}$/.test(words) ? quoted : `${mark}[text]${mark}`));
}

/** An error's words as they may be sent: numbers, tokens, ids, email addresses, quoted values and query strings named, not given. */
export function scrubText(text: string): string {
  return REPLACEMENTS.reduce((scrubbed, [pattern, replacement]) => scrubbed.replace(pattern, replacement), withoutQuotedWords(text.slice(0, LONGEST)));
}

const withoutQuery = (address: string): string => address.slice(0, LONGEST).split(/[?#]/)[0] ?? '';

/** An address as it may be sent: its path, scrubbed, with no query string or fragment. One that is not a web address is not sent. */
export function scrubUrl(url: string): string {
  return /^(?:https?:\/)?\//i.test(url) ? scrubText(withoutQuery(url)) : '[address]';
}

/** A breadcrumb as it may be kept: a request's method, address and status, or a move between screens. Any other is dropped. */
export function scrubBreadcrumb({ message: _message, data, ...kept }: Breadcrumb): Breadcrumb | null {
  const details = data ?? {};
  if (kept.category === 'navigation') return { ...kept, data: { from: scrubUrl(String(details.from)), to: scrubUrl(String(details.to)) } };
  if (kept.category !== 'fetch' && kept.category !== 'xhr') return null;
  const status = typeof details.status_code === 'number' ? { status_code: details.status_code } : {};
  return { ...kept, data: { method: String(details.method), url: scrubUrl(String(details.url)), ...status } };
}

// A script's address is sent as it is, less its query string: its name is how a source map finds it. Any other file is
// scrubbed as words are: an error with no file is given the page's own address, which holds ids.
function scrubFile(file: string): string {
  const path = withoutQuery(file);
  return /\.m?js$/.test(path) ? path : scrubText(path);
}

// A frame keeps where in the code it is: no local values, no source lines.
function scrubFrame({ vars: _vars, pre_context: _before, context_line: _line, post_context: _after, module: _module, ...frame }: StackFrame): StackFrame {
  return {
    ...frame,
    ...(frame.function ? { function: scrubText(frame.function) } : {}),
    ...(frame.filename ? { filename: scrubFile(frame.filename) } : {}),
    ...(frame.abs_path ? { abs_path: scrubFile(frame.abs_path) } : {}),
  };
}

type Mechanism = NonNullable<Exception['mechanism']>;

// How the error was caught, without the data a handler may have added to it.
const withoutData = ({ data: _data, ...mechanism }: Mechanism): Mechanism => mechanism;

// An error's kind is the name of its class, one word. Anything else in its place is not sent.
const scrubType = (type: string): string => (/^[\w$.]{1,60}$/.test(type) ? scrubText(type) : 'Error');

function scrubException({ mechanism, module: _module, ...exception }: Exception, isValue: boolean): Exception {
  return {
    ...exception,
    ...(mechanism ? { mechanism: withoutData(mechanism) } : {}),
    ...(exception.type ? { type: scrubType(exception.type) } : {}),
    ...(exception.value ? { value: isValue ? '[value]' : scrubText(exception.value) } : {}),
    ...(exception.stacktrace?.frames ? { stacktrace: { frames: exception.stacktrace.frames.map(scrubFrame) } } : {}),
  };
}

// Every error in the event, the one thrown and those it names as its cause.
const scrubExceptions = (event: SentryEvent, isValue: boolean): Exception[] => (event.exception?.values ?? []).map((exception) => scrubException(exception, isValue));

const scrubBreadcrumbs = (event: SentryEvent): Breadcrumb[] => (event.breadcrumbs ?? []).flatMap((breadcrumb) => scrubBreadcrumb(breadcrumb) ?? []);

type Request = NonNullable<SentryEvent['request']>;

// Of the page the error happened on: its address, scrubbed, and the browser's name. No other header, no cookie.
function scrubRequest(request: Request = {}): Request {
  const userAgent = request.headers?.['User-Agent'];
  return { url: scrubUrl(request.url ?? ''), ...(userAgent ? { headers: { 'User-Agent': userAgent } } : {}) };
}

type DebugMeta = NonNullable<SentryEvent['debug_meta']>;

// The id a script's source map was uploaded under (decision 0672): a UUID, with or without its dashes.
const DEBUG_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * Which source map reads each script in the stack: the script's address, scrubbed as a frame's is, and its map's id.
 * Nothing else an image may carry is sent; none when no script has a map, as in a build that uploaded none.
 */
function scrubDebugMeta(debugMeta: DebugMeta | undefined): DebugMeta | undefined {
  const images = (debugMeta?.images ?? []).flatMap((image) => {
    if (image.type !== 'sourcemap' || !DEBUG_ID.test(image.debug_id)) return [];
    return [{ type: 'sourcemap' as const, code_file: scrubFile(image.code_file), debug_id: image.debug_id }];
  });
  return images.length > 0 ? { images } : undefined;
}

// The only parts of an event sent as the SDK made them. Any other part, and any a later SDK adds, is dropped or rebuilt below.
const KEPT_AS_MADE = new Set(['type', 'event_id', 'timestamp', 'level', 'platform', 'release', 'environment', 'sdk', 'sdkProcessingMetadata']);

/**
 * An event as it may be sent: the error and where in the code it was thrown, the requests and screens before it, the
 * browser, and the tags given here. No user, no extra data, no context, and every text and address scrubbed. The tags
 * are sent as given, so they must hold nothing of a person: the app, and the route's pattern.
 */
export function scrubEvent<Sent extends SentryEvent>(event: Sent, tags: Readonly<Record<string, string>>, kind: EventKind = 'error'): Sent {
  const scrubbed: Sent = { ...event };
  for (const key of Object.keys(scrubbed)) {
    if (!KEPT_AS_MADE.has(key)) Reflect.deleteProperty(scrubbed, key);
  }
  const values = scrubExceptions(event, kind === 'value');
  scrubbed.tags = { ...tags, kind: kind === 'handled' ? 'handled' : 'error' };
  scrubbed.exception = { values };
  scrubbed.breadcrumbs = scrubBreadcrumbs(event);
  scrubbed.request = scrubRequest(event.request);
  const debugMeta = scrubDebugMeta(event.debug_meta);
  if (debugMeta) scrubbed.debug_meta = debugMeta;
  // Each handled failure is an issue of its own by its code: they are all reported from one place in the code.
  if (kind === 'handled') scrubbed.fingerprint = ['handled', values[0]?.value ?? ''];
  return scrubbed;
}
