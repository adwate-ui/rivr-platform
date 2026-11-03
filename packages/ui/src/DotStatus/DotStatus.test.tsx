import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DotStatus } from './DotStatus.tsx';

/** The dot beside the words: hidden from screen readers, as the words say the status. */
function dotOf(container: HTMLElement): Element | null {
  return container.querySelector('[data-dot]');
}

describe('DotStatus', () => {
  it('says the status in words beside a 6 px dot that screen readers skip', () => {
    const { container } = renderIn(<DotStatus tone="active" label="Waiting" />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(dotOf(container)).toHaveAttribute('aria-hidden', 'true');
    expect(dotOf(container)).toHaveClass('size-pip', 'rounded-full');
  });

  it.each([
    ['needsYou', 'bg-gold', 'text-content'],
    ['active', 'bg-cream', 'text-content'],
    ['inactive', 'bg-cream-faint', 'text-content-muted'],
    ['danger', 'bg-danger', 'text-content'],
  ] as const)('draws the %s tone with its dot and text colours', (tone, dot, text) => {
    const { container } = renderIn(<DotStatus tone={tone} label="Status" />);
    expect(dotOf(container)).toHaveClass(dot);
    expect(container.firstElementChild).toHaveClass(text, 'text-13', 'items-center', 'leading-control');
  });

  it('shows the status in full as a tooltip, and reads it in place of the short label', () => {
    const { container } = renderIn(<DotStatus tone="needsYou" label="T2 · 3" title="Table 2, seat 3" />);
    expect(container.firstElementChild).toHaveAttribute('title', 'Table 2, seat 3');
    expect(screen.getByText('T2 · 3')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Table 2, seat 3')).toHaveClass('sr-only');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<DotStatus tone="danger" label="KYC pending" title="KYC pending since 2 Nov" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
