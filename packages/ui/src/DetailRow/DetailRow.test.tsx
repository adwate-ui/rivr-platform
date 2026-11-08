import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DetailRow } from './DetailRow.tsx';

describe('DetailRow', () => {
  it('shows a label and its value under a hairline', () => {
    renderIn(<DetailRow label="Game" value="NLH 50/100" labelTone="muted" isLast />);
    expect(screen.getByText('Game')).toHaveClass('text-content-muted');
    expect(screen.getByText('NLH 50/100').parentElement).toHaveClass('border-t', 'border-b');
  });

  it('is a button with a chevron when it opens something', async () => {
    const onOpen = vi.fn();
    renderIn(<DetailRow label="House rules" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'House rules' }));
    expect(onOpen).toHaveBeenCalledOnce();
    // The chevron's ink ends on the row's edge, past its side bearing (F-157).
    expect(screen.getByRole('button', { name: 'House rules' }).querySelector('svg')?.parentElement).toHaveClass('-mr-1');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<DetailRow label="Top-up" value="Requested" valueTone="accent" hasDot size="small" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
