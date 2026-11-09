/** A card's shape: 85.6 by 54 mm, as a PAN card and an Aadhaar PVC card both are. */
export const CARD_ASPECT = 85.6 / 54;

/** The camera's frame, wider than the card so there is room round it. */
const FRAME_ASPECT = 4 / 3;
/** How much of the frame's width the card's outline takes. */
const CARD_SHARE = 0.9;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The frame within a camera's picture: the middle of it, at the frame's shape, whichever way the phone is held. */
export function frameIn(width: number, height: number): Box {
  const frameWidth = Math.min(width, height * FRAME_ASPECT);
  const frameHeight = frameWidth / FRAME_ASPECT;
  return { x: (width - frameWidth) / 2, y: (height - frameHeight) / 2, width: frameWidth, height: frameHeight };
}

/** The card's outline within the frame, centred. */
export function cardIn(frame: Box): Box {
  const width = frame.width * CARD_SHARE;
  const height = width / CARD_ASPECT;
  return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height };
}

/** A picture as grey values, one a pixel, row after row. */
export interface GreyPicture {
  readonly values: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** A canvas's red, green, blue and alpha values as grey, weighted as the eye weighs colour. */
export function greyOf(rgba: ArrayLike<number>, width: number, height: number): GreyPicture {
  const values = new Uint8Array(width * height);
  for (let at = 0; at < values.length; at += 1) {
    const pixel = at * 4;
    values[at] = Math.round(((rgba[pixel] ?? 0) * 77 + (rgba[pixel + 1] ?? 0) * 150 + (rgba[pixel + 2] ?? 0) * 29) / 256);
  }
  return { values, width, height };
}

/** A pixel's grey, the nearest one at the picture's edge. */
function greyAt(picture: GreyPicture, x: number, y: number): number {
  const column = Math.min(Math.max(Math.round(x), 0), picture.width - 1);
  const row = Math.min(Math.max(Math.round(y), 0), picture.height - 1);
  return picture.values[row * picture.width + column] ?? 0;
}

function visitBox(box: Box, step: number, visit: (x: number, y: number) => void) {
  for (let y = box.y; y < box.y + box.height; y += step) {
    for (let x = box.x; x < box.x + box.width; x += step) visit(x, y);
  }
}

// These were set from pictures drawn in tests; a real phone on real cards may move them (the shutter always works).
const DARK_MEAN = 70;
const GLARE_VALUE = 250;
const GLARE_SHARE = 0.03;
const MIN_SHARPNESS = 60;
const MAX_CHANGE = 6;
const EDGE_BAND = 8;
const EDGE_CONTRAST = 24;
const EDGE_SHARE = 0.55;
const SIDES_FOR_A_CARD = 3;

/** How bright the card is on average, and what share of it is blown out. */
function lightOf(picture: GreyPicture, box: Box) {
  let total = 0;
  let blown = 0;
  let count = 0;
  visitBox(box, 2, (x, y) => {
    const grey = greyAt(picture, x, y);
    total += grey;
    blown += grey >= GLARE_VALUE ? 1 : 0;
    count += 1;
  });
  return { mean: total / Math.max(count, 1), glare: blown / Math.max(count, 1) };
}

/** How much fine detail the card shows: the spread of each pixel's difference from its neighbours. */
function sharpnessOf(picture: GreyPicture, box: Box): number {
  let sum = 0;
  let squares = 0;
  let count = 0;
  const inner = { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 };
  visitBox(inner, 1, (x, y) => {
    const difference = 4 * greyAt(picture, x, y) - greyAt(picture, x - 1, y) - greyAt(picture, x + 1, y) - greyAt(picture, x, y - 1) - greyAt(picture, x, y + 1);
    sum += difference;
    squares += difference * difference;
    count += 1;
  });
  const mean = sum / Math.max(count, 1);
  return squares / Math.max(count, 1) - mean * mean;
}

interface Side {
  readonly from: readonly [number, number];
  readonly along: readonly [number, number];
  readonly across: readonly [number, number];
  readonly length: number;
}

/** The middle of each side of the box: a card's rounded corners are not lines. */
function sidesOf({ x, y, width, height }: Box): readonly Side[] {
  const inX = width * 0.15;
  const inY = height * 0.15;
  return [
    { from: [x + inX, y], along: [1, 0], across: [0, 1], length: width * 0.7 },
    { from: [x + inX, y + height], along: [1, 0], across: [0, 1], length: width * 0.7 },
    { from: [x, y + inY], along: [0, 1], across: [1, 0], length: height * 0.7 },
    { from: [x + width, y + inY], along: [0, 1], across: [1, 0], length: height * 0.7 },
  ];
}

/** The strongest step in brightness crossing this point of a side, within the band a slightly crooked card sits in. */
function strongestStep(picture: GreyPicture, side: Side, along: number): number {
  const x = side.from[0] + side.along[0] * along;
  const y = side.from[1] + side.along[1] * along;
  let strongest = 0;
  for (let off = -EDGE_BAND; off <= EDGE_BAND; off += 1) {
    const before = greyAt(picture, x + side.across[0] * (off - 2), y + side.across[1] * (off - 2));
    const after = greyAt(picture, x + side.across[0] * (off + 2), y + side.across[1] * (off + 2));
    strongest = Math.max(strongest, Math.abs(after - before));
  }
  return strongest;
}

function hasEdge(picture: GreyPicture, side: Side): boolean {
  let found = 0;
  let looked = 0;
  for (let along = 0; along < side.length; along += 3) {
    found += strongestStep(picture, side, along) >= EDGE_CONTRAST ? 1 : 0;
    looked += 1;
  }
  return found / Math.max(looked, 1) >= EDGE_SHARE;
}

/** How much the picture changed from the one before, on average per pixel. */
function changeBetween(current: GreyPicture, previous: GreyPicture): number {
  let total = 0;
  let count = 0;
  for (let at = 0; at < current.values.length; at += 4) {
    total += Math.abs((current.values[at] ?? 0) - (previous.values[at] ?? 0));
    count += 1;
  }
  return total / Math.max(count, 1);
}

/** What one look at the frame shows. */
export interface CardLook {
  readonly isFound: boolean;
  readonly isDark: boolean;
  readonly hasGlare: boolean;
  readonly isSharp: boolean;
  readonly isStill: boolean;
}

/** One look at the frame: is a card lined up with the outline, and is the picture good enough to keep? */
export function lookAt(current: GreyPicture, previous: GreyPicture | null): CardLook {
  const box = cardIn(frameIn(current.width, current.height));
  const light = lightOf(current, box);
  return {
    isFound: sidesOf(box).filter((side) => hasEdge(current, side)).length >= SIDES_FOR_A_CARD,
    isDark: light.mean < DARK_MEAN,
    hasGlare: light.glare > GLARE_SHARE,
    isSharp: sharpnessOf(current, box) >= MIN_SHARPNESS,
    isStill: previous !== null && changeBetween(current, previous) <= MAX_CHANGE,
  };
}

/** What the person holding the card is told. */
export type CardHint = 'find' | 'dark' | 'glare' | 'blurry' | 'steady' | 'capturing';

/** Where the guidance stands, and since when. */
export interface CardTrack {
  readonly hint: CardHint;
  readonly since: number;
}

export const START_TRACK: CardTrack = { hint: 'find', since: 0 };

const HOLD_MS = 700;

/** The first thing wrong with the picture, the one most worth fixing first; null when nothing is. */
function problemIn(look: CardLook): CardHint | null {
  if (!look.isFound) return 'find';
  if (look.isDark) return 'dark';
  if (look.hasGlare) return 'glare';
  return look.isSharp && look.isStill ? null : 'blurry';
}

/** The guidance after one look: a card that has held good for most of a second is taken; any problem starts the count again. */
export function nextCardTrack(track: CardTrack, look: CardLook, now: number): CardTrack {
  const problem = problemIn(look);
  if (problem !== null) return { hint: problem, since: now };
  if (track.hint !== 'steady' && track.hint !== 'capturing') return { hint: 'steady', since: now };
  return { hint: now - track.since >= HOLD_MS ? 'capturing' : 'steady', since: track.since };
}
