import { tokens } from '@rivr/tokens';
import { useEffect, useState } from 'react';

/**
 * What a referral card says, in the app's words: the club's name, the heading, the code's label, the code, and how a
 * referral works.
 */
export interface ReferralCardText {
  brand: string;
  heading: string;
  codeLabel: string;
  code: string;
  footer: string;
}

const SIDE = tokens.size.shareCard;
const DISPLAY = tokens.font.family.display[0];
/** The family the card's own copy of the display face goes by, ahead of the page's names for it. */
const CARD_FACE = 'RIVR Card';
const FONT = [CARD_FACE, ...tokens.font.family.display].join(', ');

/**
 * The card's artwork (decision 0258), in percent of its side: the gold frame's inset and line, and each line of text,
 * centred, by where its baseline sits, its size and its weight.
 */
const LAYOUT = {
  frame: { inset: 5.5, stroke: 0.4 },
  brand: { y: 23, size: 5.2, weight: 600 },
  heading: { y: 39, size: 6, weight: 600 },
  codeLabel: { y: 52, size: 3.7, weight: 400 },
  code: { y: 63, size: 11, weight: 600 },
  footer: { y: 80, size: 3.2, weight: 400 },
} as const;

/** A length in percent of the card's side, in the card's pixels. */
function px(percent: number): number {
  return Math.round((SIDE * percent) / 100);
}

/** Text made safe inside SVG. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Whether a face's unicode-range (`U+0000-00FF, U+0131`, or `U+0-FF` as a browser writes it) takes the letter R; none takes every letter. */
function coversLatin(range: string): boolean {
  if (range === '') return true;
  const r = 'R'.charCodeAt(0);
  return range.split(',').some((part) => {
    const [from = '', to = from] = part.trim().replace(/^U\+/i, '').split('-');
    return parseInt(from.replace(/\?/g, '0'), 16) <= r && r <= parseInt(to.replace(/\?/g, 'F'), 16);
  });
}

/** Each descriptor of a @font-face rule's text that the card reads. */
const DESCRIPTOR = {
  family: /(?:^|[{;\s])font-family\s*:\s*([^;}]+)/,
  style: /(?:^|[{;\s])font-style\s*:\s*([^;}]+)/,
  range: /(?:^|[{;\s])unicode-range\s*:\s*([^;}]+)/,
  src: /(?:^|[{;\s])src\s*:\s*([^;}]+)/,
};

/** What a @font-face rule's text gives a descriptor, or ''. */
function descriptor(cssText: string, name: keyof typeof DESCRIPTOR): string {
  return DESCRIPTOR[name].exec(cssText)?.[1]?.trim() ?? '';
}

/**
 * The display face's upright Latin file among a page's @font-face rules, each as its text gives it and resolved against
 * the stylesheet it came from; or null. Read from the text, as every browser writes it in full.
 */
export function cardFontIn(faces: readonly { cssText: string; base: string }[]): string | null {
  for (const { cssText, base } of faces) {
    if (descriptor(cssText, 'family').replace(/["']/g, '') !== DISPLAY) continue;
    if (descriptor(cssText, 'style') === 'italic' || !coversLatin(descriptor(cssText, 'range'))) continue;
    const url = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(descriptor(cssText, 'src'))?.[1];
    if (url !== undefined) return new URL(url, base).href;
  }
  return null;
}

/** The @font-face rules among a stylesheet's rules, in layers or not. */
function fontFaces(rules: CSSRuleList): CSSFontFaceRule[] {
  return Array.from(rules).flatMap((rule) => {
    if (rule instanceof CSSFontFaceRule) return [rule];
    return 'cssRules' in rule && rule.cssRules instanceof CSSRuleList ? fontFaces(rule.cssRules) : [];
  });
}

/** Where the page loads the display face's upright Latin letters from, as its own stylesheets say, or null. */
function cardFontSource(): string | null {
  return cardFontIn(Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return fontFaces(sheet.cssRules).map((face) => ({ cssText: face.cssText, base: sheet.href ?? document.baseURI }));
    } catch {
      // A stylesheet from another origin keeps its rules to itself.
      return [];
    }
  }));
}

let cardFont: Promise<string | null> | null = null;

/** The display face's Latin file as a data URL, read once; null where the page has none or it does not load. */
function loadCardFont(): Promise<string | null> {
  cardFont ??= (async () => {
    const source = cardFontSource();
    if (source === null) return null;
    try {
      const font = new Blob([await (await fetch(source)).arrayBuffer()], { type: 'font/woff2' });
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('The font could not be read'));
        reader.readAsDataURL(font);
      });
    } catch {
      return null;
    }
  })();
  return cardFont;
}

/**
 * The display face for the card (UI polish audit AS-07): an SVG drawn as an image cannot reach the page's fonts, so it
 * carries its own. Undefined while it loads, then the data URL, or null to draw in the fallback.
 */
export function useCardFont(): string | null | undefined {
  const [font, setFont] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let isShown = true;
    void loadCardFont().then((loaded) => { if (isShown) setFont(loaded); });
    return () => { isShown = false; };
  }, []);
  return font;
}

/** One centred line of the card. */
function line({ y, size, weight }: { y: number; size: number; weight: number }, fill: string, value: string): string {
  return `<text x="${px(50)}" y="${px(y)}" text-anchor="middle" font-family="${escape(FONT)}" font-size="${px(size)}" font-weight="${weight}" fill="${fill}">${escape(value)}</text>`;
}

/**
 * A member's referral card as a whole SVG document (#153; tech plan item 9): a size.shareCard square, the club's green
 * with a gold frame, the code large in gold. Self-contained, with the token colours written in, so it draws the same
 * as an image in the app and on a canvas for its PNG. With `font`, the display face as a data URL, it carries the face.
 */
export function referralCardSvg(text: ReferralCardText, font?: string | null): string {
  const { green, gold, cream, muted } = tokens.color;
  const inset = px(LAYOUT.frame.inset);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}" viewBox="0 0 ${SIDE} ${SIDE}">`,
    font ? `<defs><style>@font-face{font-family:"${CARD_FACE}";font-weight:400 900;src:url(${escape(font)}) format("woff2")}</style></defs>` : '',
    `<rect width="${SIDE}" height="${SIDE}" fill="${green}"/>`,
    `<rect x="${inset}" y="${inset}" width="${SIDE - 2 * inset}" height="${SIDE - 2 * inset}" fill="none" stroke="${gold}" stroke-width="${px(LAYOUT.frame.stroke)}"/>`,
    line(LAYOUT.brand, cream, text.brand),
    line(LAYOUT.heading, cream, text.heading),
    line(LAYOUT.codeLabel, muted, text.codeLabel),
    line(LAYOUT.code, gold, text.code),
    line(LAYOUT.footer, muted, text.footer),
    '</svg>',
  ].join('');
}

/** The card as a PNG, drawn on a canvas, to share or save. */
export async function cardToPng(svg: string): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = SIDE;
  canvas.height = SIDE;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The card could not be drawn'))), 'image/png'));
}

/** The member's referral card, as the image they share, in the display face once it is read; `alt` says what it shows. */
export function ReferralCard({ text, alt }: { text: ReferralCardText; alt: string }) {
  const font = useCardFont();
  return (
    <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(referralCardSvg(text, font))}`} alt={alt}
      className="aspect-square w-full max-w-text rounded-lg" />
  );
}
