/** Where each app runs in an end-to-end flow: this worktree's ports, or staging in a release. */
import { appPort } from '@rivr/config/worktree';

export const APPS = ['player', 'console', 'tablet', 'display', 'driver', 'web'] as const;
export type App = (typeof APPS)[number];

/** True when the flows run against staging (the release workflow). */
export function isRemoteTarget(): boolean {
  return process.env.RIVR_E2E_TARGET === 'staging';
}

/** The base URL of an app: `E2E_PLAYER_URL` and so on for staging, else the local preview server. */
export function appUrl(app: App): string {
  if (!isRemoteTarget()) return `http://127.0.0.1:${appPort(app)}`;
  const url = process.env[`E2E_${app.toUpperCase()}_URL`];
  if (!url) throw new Error(`E2E_${app.toUpperCase()}_URL is not set for the staging run`);
  return url;
}

/** The screen sizes each surface is built for (CLAUDE.md, "Done means"). */
export const VIEWPORT: Readonly<Record<App, { width: number; height: number }>> = {
  player: { width: 390, height: 844 },
  driver: { width: 390, height: 844 },
  tablet: { width: 1180, height: 820 },
  console: { width: 1440, height: 900 },
  display: { width: 1920, height: 1080 },
  web: { width: 1440, height: 900 },
};
