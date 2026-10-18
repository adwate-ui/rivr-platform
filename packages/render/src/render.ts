import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Route } from 'playwright';
import { encodeJob } from './job.ts';
import type { TemplateName, TemplateProps } from './templates/index.ts';

/** The built host page (`pnpm --filter @rivr/render build`), served to Chromium straight from disk. */
const HOST_DIR = new URL('../dist/host/', import.meta.url);
const ORIGIN = 'http://render.rivr.test';

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
