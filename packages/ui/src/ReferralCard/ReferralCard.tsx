import { tokens } from '@rivr/tokens';

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
const FONT = tokens.font.family.display.join(', ');

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

/** One centred line of the card. */
function line({ y, size, weight }: { y: number; size: number; weight: number }, fill: string, value: string): string {
  return `<text x="${px(50)}" y="${px(y)}" text-anchor="middle" font-family="${escape(FONT)}" font-size="${px(size)}" font-weight="${weight}" fill="${fill}">${escape(value)}</text>`;
}

/**
 * A member's referral card as a whole SVG document (#153; tech plan item 9): a size.shareCard square, the club's green
 * with a gold frame, the code large in gold. Self-contained, with the token colours written in, so it draws the same
 * as an image in the app and on a canvas for its PNG.
 */
export function referralCardSvg(text: ReferralCardText): string {
  const { green, gold, cream, muted } = tokens.color;
  const inset = px(LAYOUT.frame.inset);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}" viewBox="0 0 ${SIDE} ${SIDE}">`,
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

/** The member's referral card, as the image they share; `alt` says what it shows. */
export function ReferralCard({ text, alt }: { text: ReferralCardText; alt: string }) {
  return (
    <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(referralCardSvg(text))}`} alt={alt}
      className="aspect-square w-full max-w-sm rounded-lg" />
  );
}
