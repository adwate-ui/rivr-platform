import { describe, expect, it } from 'vitest';
import { cardIn, frameIn, greyOf, lookAt, nextCardTrack, START_TRACK, type CardLook, type GreyPicture } from './cardLook.ts';

const WIDTH = 480;
const HEIGHT = 360;
const CARD = cardIn(frameIn(WIDTH, HEIGHT));

const isInCard = (x: number, y: number) => x >= CARD.x && x < CARD.x + CARD.width && y >= CARD.y && y < CARD.y + CARD.height;

/** A picture from what each pixel's grey is. */
function picture(valueAt: (x: number, y: number) => number): GreyPicture {
  const values = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) values[y * WIDTH + x] = valueAt(x, y);
  return { values, width: WIDTH, height: HEIGHT };
}

/** A pale card with lines of print, on a dark table. */
const printedCard = picture((x, y) => {
  if (!isInCard(x, y)) return 20;
  return y % 6 < 2 && x % 4 < 2 ? 60 : 200;
});

const CLEAR: CardLook = { isFound: true, isDark: false, hasGlare: false, isSharp: true, isStill: true };

describe('where the card goes', () => {
  it('takes the middle of a phone held upright at the frame\'s shape', () => {
    expect(frameIn(1440, 2560)).toEqual({ x: 0, y: 740, width: 1440, height: 1080 });
  });

  it('takes the middle of a camera held sideways at the frame\'s shape', () => {
    expect(frameIn(2560, 1440)).toEqual({ x: 320, y: 0, width: 1920, height: 1440 });
  });

  it('fits a card\'s shape inside the frame, centred', () => {
    const card = cardIn({ x: 0, y: 0, width: 400, height: 300 });
    expect(card.width).toBe(360);
    expect(card.width / card.height).toBeCloseTo(85.6 / 54, 5);
    expect(card.x).toBe(20);
    expect(card.y + card.height / 2).toBeCloseTo(150, 5);
  });
});

describe('looking at the picture', () => {
  it('turns colour into grey, weighted as the eye weighs it', () => {
    const grey = greyOf([255, 255, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255], 3, 1);
    expect(grey.values[0]).toBeGreaterThanOrEqual(254);
    expect(grey.values[1]).toBeGreaterThan(grey.values[2] ?? 255);
  });

  it('finds a printed card lined up with the outline', () => {
    expect(lookAt(printedCard, printedCard)).toEqual(CLEAR);
  });

  it('finds no card on a bare table, however sharp the table is', () => {
    const table = picture((x, y) => ((x + y) % 2 === 0 ? 90 : 110));
    expect(lookAt(table, table).isFound).toBe(false);
  });

  it('calls a card with no fine detail blurred', () => {
    const smooth = picture((x, y) => (isInCard(x, y) ? 200 : 20));
    expect(lookAt(smooth, smooth).isSharp).toBe(false);
  });

  it('calls a dim card dark', () => {
    const dim = picture((x, y) => (isInCard(x, y) ? 45 + (x % 2) * 6 : 5));
    expect(lookAt(dim, dim).isDark).toBe(true);
  });

  it('sees glare when a patch of the card is blown out', () => {
    const glaring = picture((x, y) => {
      if (!isInCard(x, y)) return 20;
      return x < CARD.x + CARD.width / 5 ? 255 : 180 + (x % 2) * 40;
    });
    expect(lookAt(glaring, glaring).hasGlare).toBe(true);
  });

  it('knows a hand is still moving from the picture before', () => {
    const moved = picture((x, y) => (isInCard(x + 30, y + 20) ? 200 : 20));
    expect(lookAt(printedCard, moved).isStill).toBe(false);
    expect(lookAt(printedCard, null).isStill).toBe(false);
  });
});

describe('what to tell the person holding the card', () => {
  it('names one problem at a time, the most useful first', () => {
    expect(nextCardTrack(START_TRACK, { ...CLEAR, isFound: false, isDark: true }, 10).hint).toBe('find');
    expect(nextCardTrack(START_TRACK, { ...CLEAR, isDark: true, hasGlare: true }, 10).hint).toBe('dark');
    expect(nextCardTrack(START_TRACK, { ...CLEAR, hasGlare: true, isSharp: false }, 10).hint).toBe('glare');
    expect(nextCardTrack(START_TRACK, { ...CLEAR, isSharp: false }, 10).hint).toBe('blurry');
    expect(nextCardTrack(START_TRACK, { ...CLEAR, isStill: false }, 10).hint).toBe('blurry');
  });

  it('takes the photo only once the card has held good for most of a second', () => {
    const first = nextCardTrack(START_TRACK, CLEAR, 1000);
    expect(first).toEqual({ hint: 'steady', since: 1000 });
    const nearly = nextCardTrack(first, CLEAR, 1500);
    expect(nearly).toEqual({ hint: 'steady', since: 1000 });
    expect(nextCardTrack(nearly, CLEAR, 1700).hint).toBe('capturing');
  });

  it('starts counting again after any problem', () => {
    const good = nextCardTrack(START_TRACK, CLEAR, 1000);
    const shaken = nextCardTrack(good, { ...CLEAR, isStill: false }, 1250);
    expect(shaken).toEqual({ hint: 'blurry', since: 1250 });
    expect(nextCardTrack(shaken, CLEAR, 1500)).toEqual({ hint: 'steady', since: 1500 });
  });
});
