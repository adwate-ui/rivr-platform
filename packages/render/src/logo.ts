import { tokens } from '@rivr/tokens';
import type { VideoTiming } from './render.ts';

/** One logo animation file: its size and where it is written, relative to the repository. */
export interface LogoVideo {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

/** A reel or story (9:16) and the TV (16:9). */
export const LOGO_VIDEOS: readonly LogoVideo[] = [
  { path: 'docs/brand/logo-reel.mp4', width: tokens.viewport.story.width, height: tokens.viewport.story.height },
  { path: 'docs/brand/logo-tv.mp4', width: tokens.viewport.tv.width, height: tokens.viewport.tv.height },
];

/**
 * Half a second of green, the mark rising in (0.8 s), then the mark held: four seconds, a
 * length Instagram accepts as a reel and the TV can loop between slides.
 */
export const LOGO_TIMING: VideoTiming = { fps: 30, durationMs: 4000, leadMs: 500 };
