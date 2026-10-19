import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokens } from '@rivr/tokens';
import { expect, test } from '@playwright/test';

/** The built Storybook, served to the browser straight from disk (no server, no port). */
const STATIC_DIR = new URL('../storybook-static/', import.meta.url);
const ORIGIN = 'http://storybook.rivr.test';

/** Shell stories carry a tag naming their device; they are shot at its real size. */
const DEVICE_VIEWPORTS = {
  'viewport-phone': tokens.viewport.phone,
  'viewport-tablet': tokens.viewport.tablet,
  'viewport-console': tokens.viewport.console,
  'viewport-tv': tokens.viewport.tv,
  'viewport-feed': tokens.viewport.feed,
  'viewport-story': tokens.viewport.story,
};
type DeviceTag = keyof typeof DEVICE_VIEWPORTS;

/** Components are shot in a window wide enough for their longest story. */
const COMPONENT_VIEWPORT = { width: 960, height: 640 };

interface Story {
  id: string;
  tags: string[];
}

function isDeviceTag(tag: string): tag is DeviceTag {
  return tag in DEVICE_VIEWPORTS;
}

function asStory(entry: unknown): Story | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { id, type, tags } = { id: Reflect.get(entry, 'id'), type: Reflect.get(entry, 'type'), tags: Reflect.get(entry, 'tags') };
  if (type !== 'story' || typeof id !== 'string') return null;
  return { id, tags: Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string') : [] };
}

/** Every story in the built Storybook's index.json; docs pages are not screenshotted. */
function storiesInIndex(): Story[] {
  const index: unknown = JSON.parse(readFileSync(new URL('index.json', STATIC_DIR), 'utf8'));
  const entries = typeof index === 'object' && index !== null ? Reflect.get(index, 'entries') : undefined;
  return Object.values(typeof entries === 'object' && entries !== null ? entries : {})
    .map(asStory)
    .filter((story) => story !== null);
}

function viewportFor(story: Story) {
  const device = story.tags.find(isDeviceTag);
  return device ? DEVICE_VIEWPORTS[device] : COMPONENT_VIEWPORT;
}

test.beforeEach(async ({ context }) => {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const file = fileURLToPath(new URL(`.${new URL(route.request().url()).pathname}`, STATIC_DIR));
    await (existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 }));
  });
});

for (const story of storiesInIndex()) {
  test(story.id, async ({ page }) => {
    await page.setViewportSize(viewportFor(story));
    await page.goto(`${ORIGIN}/iframe.html?id=${story.id}&viewMode=story`);
    // Attached, not visible: a story that is only a fixed overlay, such as ChoiceSheet, leaves the body no height.
    await page.locator('body.sb-show-main, body.sb-show-errordisplay').waitFor({ state: 'attached' });
    await expect(page.locator('body.sb-show-errordisplay'), 'the story threw while rendering').toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: true });
  });
}
