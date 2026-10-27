import { ok } from '@rivr/contracts';
import type { CctvAdapter } from './types.ts';

/**
 * A recorder whose playback page takes the camera and the moment in its address (decision 0238). The template is the
 * recorder's playback URL with placeholders: `{channel}` the camera's channel, and the moment as the recorder wants
 * it: `{utc}` (`20261116T183512Z`), `{ist}` (`2026-11-17T00:05:12`, India's clock) or `{epoch}` (seconds since 1970).
 * The moment is to the second, rounded down. The recorder's make is confirmed on site; any whose playback page takes
 * these fits, and a recorder with an API for clips gets its own adapter later.
 */
export interface TemplateCctvOptions {
  readonly template: string;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// A query key that would carry a login: the link reaches every staff member who may see the hand or incident.
const LOGIN_KEY = /user|pass|pwd|token|auth|key|login|session/i;

function parsed(address: string): URL | null {
  try {
    return new URL(address);
  } catch {
    return null;
  }
}

/**
 * True for a template this adapter can fill: an http(s) address whose host holds no placeholder, with the channel and
 * one form of the moment after it, and no login in it (no user or password, no query key such as `password`). The
 * recorder asks each person to sign in instead.
 */
export function isRecorderTemplate(template: string): boolean {
  if (!/^https?:\/\/[^\s{}/@]+\//.test(template) || !template.includes('{channel}') || !/\{(utc|ist|epoch)\}/.test(template)) return false;
  const url = parsed(template.replaceAll(/\{(channel|utc|ist|epoch)\}/g, 'x'));
  return url !== null && url.username === '' && url.password === '' && ![...url.searchParams.keys()].some((key) => LOGIN_KEY.test(key));
}

function utcCompact(at: Date): string {
  return `${at.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

function istLocal(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19);
}

/** The recorder at `template`: a playback link for a camera from a moment, without calling the recorder. */
export function createTemplateCctv({ template }: TemplateCctvOptions): CctvAdapter {
  return {
    async playbackLink({ cameraId, at }) {
      const url = template
        .replaceAll('{channel}', encodeURIComponent(cameraId))
        .replaceAll('{utc}', utcCompact(at))
        .replaceAll('{ist}', istLocal(at))
        .replaceAll('{epoch}', String(Math.floor(at.getTime() / 1000)));
      return ok({ url });
    },
  };
}
