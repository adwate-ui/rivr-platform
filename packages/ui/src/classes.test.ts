import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The utilities whose value comes from the token theme. The theme replaces Tailwind's own scale, so a value off it
// (mt-14, min-h-11, max-w-sm, aspect-video before its token) builds no CSS, and nothing else says so (F5-02).
const THEMED = new RegExp(
  '^-?(?:m[trblxyse]?|p[trblxyse]?|gap(?:-[xy])?|space-[xy]|[wh]|size|min-[wh]|max-[wh]|inset(?:-[xy])?|top|right|bottom|left|start|end|'
  + 'basis|text|font|leading|tracking|rounded(?:-[trblse]{1,2})?|border(?:-[trblxyse])?|outline|ring|divide(?:-[xy])?|fill|stroke|from|via|to|'
  + 'bg|aspect|z|opacity|shadow|duration|ease|translate-[xy]|scroll-[mp][trblxyse]?)-[a-z0-9./]+$',
);

/** The component sources: every .ts and .tsx under src, not tests or stories. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Every word of every string literal in a source: the class lists are among them. */
function wordsIn(source: string): string[] {
  return [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)].flatMap((match) => (match[1] ?? match[2] ?? match[3] ?? '').split(/\s+/));
}

/** The selector Tailwind writes for a class, `medium:h-12` as `.medium\\:h-12`, whole: not the start of a longer one. */
function hasRule(css: string, name: string): boolean {
  const selector = `.${name.replace(/[:./[\]()%#,*=&>@'"]/g, (character) => `\\${character}`)}`;
  const escaped = selector.replace(/[\\^$.*+?()[\]{}|]/g, (character) => `\\${character}`);
  return new RegExp(`${escaped}(?=[\\s{,:>.[)])`).test(css);
}

/** The stylesheet as the build makes it: the fonts file first, as the build's first step does, then Tailwind's CLI. */
function builtStylesheet(): string {
  execFileSync('node', ['scripts/fonts.mjs'], { stdio: ['ignore', 'ignore', 'inherit'] });
  return execFileSync(join('node_modules', '.bin', 'tailwindcss'), ['-i', 'src/styles.css'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

describe('the classes @rivr/ui draws with', () => {
  it('each have a rule in the built stylesheet, so none is off the token scale and silently missing', () => {
    const css = builtStylesheet();
    const missing = new Set<string>();
    for (const file of sources('src')) {
      for (const word of wordsIn(readFileSync(file, 'utf8'))) {
        const utility = word.split(':').at(-1) ?? '';
        if (THEMED.test(utility) && !hasRule(css, word)) missing.add(`${file}: ${word}`);
      }
    }
    expect([...missing]).toEqual([]);
  }, 60_000);
});
