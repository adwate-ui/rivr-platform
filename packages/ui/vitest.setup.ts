// Adds the DOM matchers (toBeInTheDocument, toHaveAccessibleName...) and unmounts after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no layout, so it has no ResizeObserver; Radix's ScrollArea needs one to exist.
class NoLayoutResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoLayoutResizeObserver;

// axe-core probes for canvas support; jsdom has none and would log "not implemented" for each run.
HTMLCanvasElement.prototype.getContext = () => null;
