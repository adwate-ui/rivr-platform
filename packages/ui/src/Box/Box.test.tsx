import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Box } from './Box.tsx';

describe('Box', () => {
  it('renders its children in a div by default', () => {
    renderIn(<Box>Table 3</Box>);
    expect(screen.getByText('Table 3').tagName).toBe('DIV');
  });

  it('renders the landmark it is asked for, with its accessible name', () => {
    renderIn(
      <Box as="section" aria-label="Tonight">
        Five tables open
      </Box>,
    );
    expect(screen.getByRole('region', { name: 'Tonight' })).toHaveTextContent('Five tables open');
  });

  it('draws surfaces and hairlines from the token theme only', () => {
    renderIn(
      <Box surface="raised" hairline="bottom" padding={4} radius="lg">
        Row
      </Box>,
    );
    expect(screen.getByText('Row')).toHaveClass('bg-raised', 'border-b', 'border-hairline', 'p-4', 'rounded-lg');
  });

  it('adds no class attribute when nothing is set', () => {
    renderIn(<Box>Plain</Box>);
    expect(screen.getByText('Plain')).not.toHaveAttribute('class');
  });

  it('stays in view at the top of a scrolling page from 768 px, at its own height in a grid, when asked', () => {
    renderIn(<Box isSticky>In one line</Box>);
    expect(screen.getByText('In one line')).toHaveClass('medium:sticky', 'medium:top-0', 'medium:self-start');
  });

  it('keeps a sticky bar the whole width of its column, up against the top of the console\u2019s main (F-029)', () => {
    renderIn(<Box isStickyBar>Actions</Box>);
    expect(screen.getByText('Actions')).toHaveClass('sticky', '-top-7', 'z-nav');
  });

  it('keeps a field reached by keyboard clear of the bar, however tall it is now, and lets go when it leaves (WCAG 2.4.11)', () => {
    let measure: () => unknown = () => undefined;
    vi.stubGlobal('ResizeObserver', vi.fn(function observer(callback: () => unknown) {
      measure = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }));
    const { unmount } = renderIn(<main><Box isStickyBar>Actions</Box></main>);
    const main = screen.getByRole('main');
    Object.defineProperty(screen.getByText('Actions'), 'offsetHeight', { value: 144 });
    measure();
    expect(main.style.getPropertyValue('scroll-padding-top')).toBe('calc(144px + var(--rivr-space-2))');
    unmount();
    expect(main.style.getPropertyValue('scroll-padding-top')).toBe('');
    vi.unstubAllGlobals();
  });
});
