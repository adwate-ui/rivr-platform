import { tokens } from '@rivr/tokens';

/** What a referral card says, in the app's words: the heading, the code's label, the code, and how a referral works. */
export interface ReferralCardText {
  heading: string;
  codeLabel: string;
  code: string;
  footer: string;
}

const SIZE = 1080;
const FONT = tokens.font.family.display.join(', ');

/** Text made safe inside SVG. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A member's referral card as a whole SVG document (#153; tech plan item 9): 1080 px square, the club's green with a
 * gold rule, the code large in gold. Self-contained, with the token colours written in, so it draws the same as an
 * image in the app and on a canvas for its PNG.
 */
export function referralCardSvg({ heading, codeLabel, code, footer }: ReferralCardText): string {
  const { green, gold, cream, muted } = tokens.color;
  // Large lines are set heavier.
  const text = (y: number, size: number, fill: string, value: string) =>
    `<text x="540" y="${y}" text-anchor="middle" font-family="${escape(FONT)}" font-size="${size}" font-weight="${size >= 56 ? 600 : 400}" fill="${fill}">${escape(value)}</text>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `<rect width="${SIZE}" height="${SIZE}" fill="${green}"/>`,
    `<rect x="60" y="60" width="960" height="960" fill="none" stroke="${gold}" stroke-width="4"/>`,
    text(250, 56, cream, 'RIVR'),
    text(420, 64, cream, heading),
    text(560, 40, muted, codeLabel),
    text(680, 120, gold, code),
    text(860, 34, muted, footer),
    '</svg>',
  ].join('');
}

/** The card as a PNG, drawn on a canvas, to share or save. */
export async function cardToPng(svg: string): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
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
