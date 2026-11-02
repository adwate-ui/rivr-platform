import { describe, expect, it } from 'vitest';
import { nextTrack, START } from './faceGuidance.ts';

const WIDTH = 1000;
const FACE = { x: 300, width: 400 };

describe('the selfie camera\'s guidance', () => {
  it('asks the member to come closer with no face, two faces, or a face too small for the oval', () => {
    expect(nextTrack(START, [], WIDTH, 100).guidance).toBe('closer');
    expect(nextTrack(START, [FACE, FACE], WIDTH, 100).guidance).toBe('closer');
    expect(nextTrack(START, [{ x: 450, width: 300 }], WIDTH, 100).guidance).toBe('closer');
  });

  it('asks them to hold still once one face fills the oval, and takes the photo after a second held still', () => {
    const first = nextTrack(START, [FACE], WIDTH, 0);
    expect(first.guidance).toBe('steady');
    const still = nextTrack(first, [{ x: 320, width: 400 }], WIDTH, 600);
    expect(still.guidance).toBe('steady');
    expect(nextTrack(still, [{ x: 310, width: 400 }], WIDTH, 1000).guidance).toBe('capturing');
  });

  it('starts the second again when the face moves', () => {
    const first = nextTrack(START, [FACE], WIDTH, 0);
    const moved = nextTrack(first, [{ x: 400, width: 400 }], WIDTH, 900);
    expect(moved).toMatchObject({ guidance: 'steady', since: 900 });
    expect(nextTrack(moved, [{ x: 400, width: 400 }], WIDTH, 1500).guidance).toBe('steady');
  });
});
