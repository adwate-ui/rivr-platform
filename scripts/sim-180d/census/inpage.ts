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
  for (const el of document.querySelectorAll('body *')) {
    if (clipped.length >= 15) break;
    const style = getComputedStyle(el);
    if (!['hidden', 'clip'].includes(style.overflowY) || !el.innerText || el.scrollHeight <= el.clientHeight + 1) continue;
    if (['auto', 'scroll'].includes(style.overflowX) || el.clientHeight === 0) continue;
    clipped.push('cut off below or above: ' + el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40));
  }
  const generic = ['system-ui', 'sans-serif', 'serif', 'monospace', '-apple-system', 'ui-monospace', 'ui-sans-serif', 'inherit'];
  const families = new Set();
  for (const el of [document.body, ...document.querySelectorAll('h1, h2, h3, p, button, label, td, th, a, span')].slice(0, 300)) {
    families.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
  }
  const fallback = [...families].filter((family) => family && !generic.includes(family) && !document.fonts.check('16px "' + family + '"'));
  for (const face of document.fonts) if (face.status === 'error') fallback.push(face.family.replace(/["']/g, ''));
  // Photos, avatars and icons that should fill their frame: each box that holds an image, measured against its nearest
  // framed ancestor (a border, a radius or clipping). Where the box is meant to fill the frame (85% of it or more each
  // way), an uneven gap is off-centre and any gap shows the frame's colour (the 8 Nov card photo's stripe).
  const px = (value) => parseFloat(value) || 0;
  const framed = (el) => {
    const style = getComputedStyle(el);
    return style.overflow !== 'visible' || px(style.borderTopWidth) > 0 || px(style.borderTopLeftRadius) > 0;
  };
  const colourOf = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return 'none';
  };
  const offCentre = [];
  const boxes = new Set();
  for (const img of document.querySelectorAll('img, svg[role="img"], canvas')) {
    boxes.add(img);
    for (let up = img.parentElement, depth = 0; up && depth < 3; up = up.parentElement, depth += 1) if (framed(up)) { boxes.add(up); break; }
  }
  // Photo and avatar frames whether or not their image loaded: small boxes with a border that clip what they hold.
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width <= 160 && r.height <= 160 && px(style.borderTopWidth) > 0 && style.overflow !== 'visible') boxes.add(el);
  }
  for (const box of boxes) {
    const r = box.getBoundingClientRect();
    if (!shown(box, r) || offCentre.length >= 15) continue;
    let frame = box.parentElement;
    for (let depth = 0; frame && depth < 3 && !framed(frame); depth += 1) frame = frame.parentElement;
    if (!frame || frame === document.body) continue;
    const f = frame.getBoundingClientRect();
    const s = getComputedStyle(frame);
    const inner = { left: f.left + px(s.borderLeftWidth) + px(s.paddingLeft), right: f.right - px(s.borderRightWidth) - px(s.paddingRight),
      top: f.top + px(s.borderTopWidth) + px(s.paddingTop), bottom: f.bottom - px(s.borderBottomWidth) - px(s.paddingBottom) };
    const width = inner.right - inner.left;
    const height = inner.bottom - inner.top;
    if (width <= 0 || height <= 0 || r.width < width * 0.85 || r.height < height * 0.85) continue;
    const gap = { left: r.left - inner.left, right: inner.right - r.right, top: r.top - inner.top, bottom: inner.bottom - r.bottom };
    const uneven = Math.abs(gap.left - gap.right) > 1.5 || Math.abs(gap.top - gap.bottom) > 1.5;
    const showing = Math.max(gap.left, gap.right, gap.top, gap.bottom) > 1;
    if (uneven || showing) {
      const round = (value) => Math.round(value * 10) / 10;
      offCentre.push((box.getAttribute('alt') || name(box)) + ': gaps L' + round(gap.left) + ' R' + round(gap.right) + ' T' + round(gap.top) +
        ' B' + round(gap.bottom) + ' px in a ' + round(width) + 'x' + round(height) + ' frame, showing ' + colourOf(frame));
    }
  }
  // Near misses in alignment (the 3 Nov sign-up): siblings stacked in a column whose left edges differ by 1 to 4 px, and
  // a box its parent centres (flex centring or auto margins) that sits more than 1.5 px off the parent's centre.
  const misaligned = [];
  for (const parent of document.querySelectorAll('body *')) {
    if (misaligned.length >= 15) break;
    const kids = [...parent.children].filter((kid) => shown(kid, kid.getBoundingClientRect()));
    if (kids.length === 0) continue;
    const ps = getComputedStyle(parent);
    const pr = parent.getBoundingClientRect();
    const column = ps.display.includes('flex') ? ps.flexDirection.startsWith('column') : ps.display === 'block' || ps.display === 'grid';
    if (column && kids.length >= 2) {
      const lefts = [...new Set(kids.map((kid) => Math.round(kid.getBoundingClientRect().left * 2) / 2))].sort((a, b) => a - b);
      for (let i = 1; i < lefts.length; i += 1) {
        const step = lefts[i] - lefts[i - 1];
        if (step > 0.5 && step <= 4) { misaligned.push(name(parent) + ': left edges ' + lefts[i - 1] + ' and ' + lefts[i] + ' px'); break; }
      }
    }
    const centring = (ps.display.includes('flex') && (ps.flexDirection.startsWith('column') ? ps.alignItems === 'center' : ps.justifyContent === 'center'));
    for (const kid of kids) {
      const ks = getComputedStyle(kid);
      if (!(centring && kids.length === 1) && !(ks.marginLeft === ks.marginRight && px(ks.marginLeft) > 0 && ks.display === 'block')) continue;
      const kr = kid.getBoundingClientRect();
      const innerLeft = pr.left + px(ps.borderLeftWidth) + px(ps.paddingLeft);
      const innerRight = pr.right - px(ps.borderRightWidth) - px(ps.paddingRight);
      const off = (kr.left + kr.right) / 2 - (innerLeft + innerRight) / 2;
      if (kr.width < innerRight - innerLeft - 1 && Math.abs(off) > 1.5) {
        misaligned.push(name(kid) + ': ' + Math.round(off * 10) / 10 + ' px off the centre of ' + name(parent));
        break;
      }
    }
  }
  const navigation = performance.getEntriesByType('navigation')[0];
  const scripts = performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'script');
  return {
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    tinyTargets: [...new Set(tiny)].slice(0, 25),
    smallTargets: [...new Set(small)].slice(0, 25),
    clipped: [...new Set(clipped)],
    fallbackFonts: [...new Set(fallback)],
    offCentre,
    misaligned,
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
  offCentre: z.array(z.string()),
  misaligned: z.array(z.string()),
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
