import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from 'mediabunny';
import { describe, expect, it } from 'vitest';
import { LOGO_TIMING, LOGO_VIDEOS } from './logo.ts';
import { renderFrameToPng, renderToMp4 } from './render.ts';
import { allowedDifference, differentPixels } from './test/png.ts';

/** The video track of an MP4, read back with Mediabunny's demuxer: codec, size, frames and length. */
async function readVideo(mp4: Buffer) {
  const input = new Input({ source: new BufferSource(mp4), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('The MP4 has no video track.');
  let frames = 0;
  for await (const packet of new EncodedPacketSink(track).packets()) {
    if (packet.byteLength > 0) frames += 1;
  }
  return { codec: track.codec, width: track.displayWidth, height: track.displayHeight, frames, seconds: await input.computeDuration() };
}

describe('renderToMp4', () => {
  it('draws the animated lockup to an H.264 MP4 of the requested size, one frame per step', async () => {
    const mp4 = await renderToMp4(
      { template: 'brand.art', props: { art: 'lockup', isAnimated: true }, width: 360, height: 640 },
      { fps: 10, durationMs: 1500, leadMs: 200 },
    );
    expect(mp4.toString('latin1', 4, 8)).toBe('ftyp');
    expect(await readVideo(mp4)).toEqual({ codec: 'avc', width: 360, height: 640, frames: 15, seconds: 1.5 });
  });
});

describe('renderFrameToPng', () => {
  const animated = { template: 'brand.art', props: { art: 'lockup', isAnimated: true }, width: 360, height: 640 } as const;

  it('holds the animation where asked: nothing at the start, half the mark midway, all of it once every tile is in', async () => {
    const frame = (ms: number) => renderFrameToPng(animated, ms);
    // Five tiles a stagger apart, then the tagline, each rising in 200 ms: in by 800 ms, then still.
    const [start, midway, done, later] = await Promise.all([frame(0), frame(400), frame(1000), frame(3000)]);
    const fromLater = (shot: Buffer) => differentPixels(shot, later);
    const [atStart, atMidway, atDone] = await Promise.all([fromLater(start), fromLater(midway), fromLater(done)]);
    expect(atMidway).toBeGreaterThan(10 * allowedDifference(360, 640));
    expect(atStart).toBeGreaterThan(atMidway);
    // Done is the held mark. Its edges may be smoothed a little differently from machine to machine,
    // as a tile that has just finished moving can still be drawn on its own layer.
    expect(atDone * 3).toBeLessThan(atMidway);
  });
});

describe('the logo animation', () => {
  it('is written for a reel (9:16) and the TV (16:9), four seconds at 30 frames a second', () => {
    expect(LOGO_VIDEOS.map(({ width, height }) => [width, height])).toEqual([[1080, 1920], [1920, 1080]]);
    expect(LOGO_TIMING).toEqual({ fps: 30, durationMs: 4000, leadMs: 500 });
  });
});
