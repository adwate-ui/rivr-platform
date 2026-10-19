import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Route } from 'playwright';
import { encodeJob } from './job.ts';
import type { TemplateName, TemplateProps } from './templates/index.ts';

/** The built host page (`pnpm --filter @rivr/render build`), served to Chromium straight from disk. */
const HOST_DIR = new URL('../dist/host/', import.meta.url);
// HTTPS, so the page may use WebCodecs to encode video; requests never leave Playwright.
const ORIGIN = 'https://render.rivr.test';

/** One template drawn at a size. */
export interface RenderRequest<Name extends TemplateName> {
  template: Name;
  props: TemplateProps<Name>;
  /** Width and height in CSS pixels; the image has exactly this many pixels. */
  width: number;
  height: number;
}

async function serveHostFile(route: Route): Promise<void> {
  const file = fileURLToPath(new URL(`.${new URL(route.request().url()).pathname}`, HOST_DIR));
  await (existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 }));
}

/** Waits until the host has drawn the template, failing fast if the page throws instead. */
async function waitUntilDrawn(page: Page): Promise<void> {
  const failed = new Promise<never>((_, reject) => page.once('pageerror', reject));
  failed.catch(() => undefined);
  await Promise.race([page.locator('body[data-render-ready="true"]').waitFor(), failed]);
}

/** Opens the template in headless Chromium at the requested size and hands the page to `capture`. */
async function withDrawnPage<Name extends TemplateName, Result>(request: RenderRequest<Name>, capture: (page: Page) => Promise<Result>): Promise<Result> {
  if (!existsSync(new URL('index.html', HOST_DIR))) {
    throw new Error('The render host is not built. Run `pnpm --filter @rivr/render build`.');
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: request.width, height: request.height }, deviceScaleFactor: 1 });
    await page.route(`${ORIGIN}/**`, serveHostFile);
    const job = encodeJob({ template: request.template, props: request.props });
    await page.goto(`${ORIGIN}/index.html?job=${encodeURIComponent(job)}`);
    await waitUntilDrawn(page);
    return await capture(page);
  } finally {
    await browser.close();
  }
}

/** Draws a template to a PNG of exactly `width` by `height` pixels. */
export function renderToPng<Name extends TemplateName>(request: RenderRequest<Name>): Promise<Buffer> {
  return withDrawnPage(request, (page) => page.screenshot({ type: 'png' }));
}

/** Draws a template to a one-page PDF of `width` by `height` CSS pixels, backgrounds included. */
export function renderToPdf<Name extends TemplateName>(request: RenderRequest<Name>): Promise<Buffer> {
  return withDrawnPage(request, async (page) => {
    await page.emulateMedia({ media: 'screen' });
    return page.pdf({
      width: `${request.width}px`,
      height: `${request.height}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      pageRanges: '1',
    });
  });
}

/** How long a video runs and how smooth it is. */
export interface VideoTiming {
  /** Frames per second. */
  fps: number;
  /** The whole video, in milliseconds. */
  durationMs: number;
  /** Still frames before the template's animations start, in milliseconds. */
  leadMs: number;
}

/** Holds every animation on the page at `ms` from its start, so a frame is the same on every run. */
async function seekAnimations(page: Page, ms: number): Promise<void> {
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = at;
    }
  }, ms);
}

/**
 * Draws a template's CSS animations to an H.264 MP4 of exactly `width` by `height` pixels: each frame
 * is the page captured with its animations held at that frame's time, encoded in Chromium (WebCodecs).
 */
export function renderToMp4<Name extends TemplateName>(request: RenderRequest<Name>, timing: VideoTiming): Promise<Buffer> {
  return withDrawnPage(request, async (page) => {
    await page.evaluate(({ width, height, fps }) => window.rivrVideo?.start(width, height, fps), { ...request, fps: timing.fps });
    const frames = Math.round((timing.durationMs * timing.fps) / 1000);
    for (let frame = 0; frame < frames; frame += 1) {
      await seekAnimations(page, Math.max(0, (frame * 1000) / timing.fps - timing.leadMs));
      const png = await page.screenshot({ type: 'png' });
      await page.evaluate((image) => window.rivrVideo?.add(image), png.toString('base64'));
    }
    const mp4 = await page.evaluate(() => window.rivrVideo?.finish());
    if (mp4 === undefined) throw new Error('The render host has no video recorder.');
    return Buffer.from(mp4, 'base64');
  });
}
