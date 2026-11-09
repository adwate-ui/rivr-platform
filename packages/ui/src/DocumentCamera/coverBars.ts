import { tokens } from '@rivr/tokens';

/** A black bar over part of a photo, each measure a share of the photo, 0 to 1. */
export interface CoverBar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the first eight digits and the QR code sit on an Aadhaar's front, once the card fills its outline. A start only:
 * staff move each bar onto the card in their hand.
 */
export const AADHAAR_FRONT_COVERS: readonly CoverBar[] = [
  { x: 0.22, y: 0.72, width: 0.34, height: 0.13 },
  { x: 0.72, y: 0.3, width: 0.25, height: 0.45 },
];

/** Where a new bar starts, for a number printed again elsewhere. */
export const NEW_COVER: CoverBar = { x: 0.3, y: 0.42, width: 0.34, height: 0.13 };

const SMALLEST = 0.05;
// The server takes a photo of at most 2 MB, and a busy card at full quality can come close.
const MAX_PHOTO_BYTES = 1_900_000;
const QUALITIES = [0.92, 0.82, 0.72];

/** The canvas as a JPEG at the best of those qualities that fits, or the last. */
export async function cardJpeg(canvas: HTMLCanvasElement, qualities: readonly number[] = QUALITIES): Promise<Blob> {
  const [quality, ...lower] = qualities;
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('The card photo was not made'))), 'image/jpeg', quality);
  });
  return jpeg.size <= MAX_PHOTO_BYTES || lower.length === 0 ? jpeg : await cardJpeg(canvas, lower);
}

const within = (value: number, lowest: number, highest: number) => Math.min(Math.max(value, lowest), highest);

/** The bar moved by these shares of the photo, kept on it. */
export function moved(bar: CoverBar, byX: number, byY: number): CoverBar {
  return { ...bar, x: within(bar.x + byX, 0, 1 - bar.width), y: within(bar.y + byY, 0, 1 - bar.height) };
}

/** The bar resized from its corner, never to nothing and never off the photo. */
export function resized(bar: CoverBar, byWidth: number, byHeight: number): CoverBar {
  return { ...bar, width: within(bar.width + byWidth, SMALLEST, 1 - bar.x), height: within(bar.height + byHeight, SMALLEST, 1 - bar.y) };
}

/**
 * The photo with its bars painted in, as a new JPEG: what is under them is gone, not hidden. Nothing leaves the device
 * but this copy. It refuses to run with no bars, so a covered photo always has one.
 */
export async function coveredPhoto(photo: Blob, bars: readonly CoverBar[]): Promise<Blob> {
  if (bars.length === 0) throw new Error('A covered photo needs its bars');
  const image = await createImageBitmap(photo);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No canvas to cover the photo on');
  context.drawImage(image, 0, 0);
  context.fillStyle = tokens.color.greenBlack;
  for (const bar of bars) context.fillRect(bar.x * image.width, bar.y * image.height, bar.width * image.width, bar.height * image.height);
  image.close();
  return await cardJpeg(canvas);
}
