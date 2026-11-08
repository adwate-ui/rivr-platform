/**
 * What the census measures inside the page, as plain browser JavaScript run by page.evaluate (so no types cross the
 * boundary); each result is parsed with zod on the way back. Kept as strings because they run in the browser.
 */
import { z } from 'zod';

/** Records the largest contentful paint as the page loads (installed before it opens). */
export const LCP_PROBE = `(() => {
  window.__rivrLcp = null;
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__rivrLcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (error) { window.__rivrLcp = null; }
})()`;

/** Layout and text facts: sideways scroll, small targets, clipped text, fonts, timings, the text itself. */
export const LAYOUT_FACTS = `(() => {
  const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || el.tagName)
    .replace(/\\s+/g, ' ').trim().slice(0, 40);
  const shown = (el, r) => r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0;
  const inSentence = (el) => {
    const block = el.closest('p, li');
    return el.tagName === 'A' && block !== null && block.innerText.length > el.innerText.length + 10;
  };
  const tiny = [];
  const small = [];
  const targets = 'a[href], button, [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="link"], input:not([type="hidden"]), select, textarea, summary';
  for (const el of document.querySelectorAll(targets)) {
    const r = el.getBoundingClientRect();
    if (!shown(el, r) || inSentence(el)) continue;
    const side = Math.min(r.width, r.height);
    if (side < 24) tiny.push(name(el)); else if (side < 44) small.push(name(el));
  }
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (clipped.length >= 15 || el.children.length > 0 || !el.innerText) continue;
    const style = getComputedStyle(el);
    const cuts = style.textOverflow === 'ellipsis' || ['hidden', 'clip'].includes(style.overflowX);
    if (cuts && el.scrollWidth > el.clientWidth + 1) clipped.push(el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40));
  }
  const generic = ['system-ui', 'sans-serif', 'serif', 'monospace', '-apple-system', 'ui-monospace', 'ui-sans-serif', 'inherit'];
  const families = new Set();
  for (const el of [document.body, ...document.querySelectorAll('h1, h2, h3, p, button, label, td, th, a, span')].slice(0, 300)) {
    families.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
  }
  const fallback = [...families].filter((family) => family && !generic.includes(family) && !document.fonts.check('16px "' + family + '"'));
  for (const face of document.fonts) if (face.status === 'error') fallback.push(face.family.replace(/["']/g, ''));
  const navigation = performance.getEntriesByType('navigation')[0];
  const scripts = performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'script');
  return {
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    tinyTargets: [...new Set(tiny)].slice(0, 25),
    smallTargets: [...new Set(small)].slice(0, 25),
    clipped: [...new Set(clipped)],
    fallbackFonts: [...new Set(fallback)],
    lcpMs: typeof window.__rivrLcp === 'number' ? window.__rivrLcp : null,
    loadMs: navigation ? Math.round(navigation.loadEventEnd || navigation.duration) : null,
    scriptBytes: scripts.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0),
    title: document.title,
    text: document.body.innerText,
  };
})()`;

export const layoutSchema = z.object({
  overflowX: z.boolean(),
  tinyTargets: z.array(z.string()),
  smallTargets: z.array(z.string()),
  clipped: z.array(z.string()),
  fallbackFonts: z.array(z.string()),
  lcpMs: z.number().nullable(),
  loadMs: z.number().nullable(),
  scriptBytes: z.number(),
  title: z.string(),
  text: z.string(),
});

/** axe-core, injected beforehand, on WCAG 2.0, 2.1 and 2.2 A and AA, with nothing turned off. */
export const AXE_RUN = `(async () => {
  const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
  return result.violations.map((violation) => ({
    id: violation.id, impact: violation.impact ?? null, nodes: violation.nodes.length, help: violation.help,
    targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
  }));
})()`;

export const axeSchema = z.array(z.object({
  id: z.string(),
  impact: z.enum(['minor', 'moderate', 'serious', 'critical']).nullable(),
  nodes: z.number(),
  help: z.string(),
  targets: z.array(z.string()),
}));

/** Same-origin links in the screen's own content (not the menu), for the Back check. */
export const CONTENT_LINKS = `(() => {
  const links = [...document.querySelectorAll('main a[href], [role="main"] a[href]')]
    .map((a) => a.href).filter((href) => href.startsWith(location.origin) && href !== location.href);
  return [...new Set(links)].slice(0, 6);
})()`;

export const linksSchema = z.array(z.string());
