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
  /** Width and height in CSS pixels; the image has exactly this many pixels, times `scale`. */
  width: number;
  /** Left out, the page is as tall as what it draws, as a receipt is. */
  height?: number | undefined;
  /** Device pixels to each CSS pixel, 1 unless set: the membership card is drawn at 3 for a sharp image. */
  scale?: number | undefined;
  /**
   * `one`, the default: what is drawn must fit one page of `height`. `all`: it runs onto as many pages of `height` as
   * it needs, as the offline pack does (#167); a PNG is then its first page.
   */
  pages?: 'one' | 'all' | undefined;
}

/** The size a page was drawn at, in CSS pixels. */
interface DrawnSize {
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

/**
 * Without a requested height, makes the page exactly as tall as what it drew. With one, refuses a template
 * that drew more than fits, such as a statement too long for one A4 page, rather than cut its end off.
 */
async function fitHeight(page: Page, width: number, height: number | undefined, pages: 'one' | 'all'): Promise<DrawnSize> {
  const drawn = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height === undefined) {
    await page.setViewportSize({ width, height: drawn });
    return { width, height: drawn };
  }
  if (drawn > height && pages === 'one') throw new Error(`The template drew ${String(drawn)} px, more than the ${String(height)} px page.`);
  return { width, height };
}

/** Opens the template in headless Chromium at the requested size and hands the page, and its size, to `capture`. */
async function withDrawnPage<Name extends TemplateName, Result>(
  request: RenderRequest<Name>,
  capture: (page: Page, size: DrawnSize) => Promise<Result>,
): Promise<Result> {
  if (!existsSync(new URL('index.html', HOST_DIR))) {
    throw new Error('The render host is not built. Run `pnpm --filter @rivr/render build`.');
  }
  const browser = await chromium.launch();
  try {
    const viewport = { width: request.width, height: request.height ?? 1 };
    const page = await browser.newPage({ viewport, deviceScaleFactor: request.scale ?? 1 });
    await page.route(`${ORIGIN}/**`, serveHostFile);
    const job = encodeJob({ template: request.template, props: request.props });
    await page.goto(`${ORIGIN}/index.html?job=${encodeURIComponent(job)}`);
    await waitUntilDrawn(page);
    return await capture(page, await fitHeight(page, request.width, request.height, request.pages ?? 'one'));
  } finally {
    await browser.close();
  }
}

/** Draws a template to a PNG of exactly `width` by `height` pixels, times `scale`. */
export function renderToPng<Name extends TemplateName>(request: RenderRequest<Name>): Promise<Buffer> {
  return withDrawnPage(request, (page) => page.screenshot({ type: 'png' }));
}

/** Draws a template to a PDF of `width` by `height` CSS pixels, backgrounds included: one page, or with `pages: 'all'` every page. */
export function renderToPdf<Name extends TemplateName>(request: RenderRequest<Name>): Promise<Buffer> {
  return withDrawnPage(request, async (page, size) => {
    await page.emulateMedia({ media: 'screen' });
    return page.pdf({
      width: `${size.width}px`,
      height: `${size.height}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      ...(request.pages === 'all' ? {} : { pageRanges: '1' }),
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

/** Draws a template with every animation held at `atMs` from its start: one frame of its video, as a PNG. */
export function renderFrameToPng<Name extends TemplateName>(request: RenderRequest<Name>, atMs: number): Promise<Buffer> {
  return withDrawnPage(request, async (page) => {
    await seekAnimations(page, atMs);
    return page.screenshot({ type: 'png' });
  });
}

/**
 * Draws a template's CSS animations to an H.264 MP4 of exactly `width` by `height` pixels: each frame
 * is the page captured with its animations held at that frame's time, encoded in Chromium (WebCodecs).
 */
export function renderToMp4<Name extends TemplateName>(request: RenderRequest<Name>, timing: VideoTiming): Promise<Buffer> {
  return withDrawnPage(request, async (page, size) => {
    await page.evaluate(({ width, height, fps }) => window.rivrVideo?.start(width, height, fps), { ...size, fps: timing.fps });
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
