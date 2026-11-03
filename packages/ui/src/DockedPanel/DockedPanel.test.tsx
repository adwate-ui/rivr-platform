import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DockedPanel } from './DockedPanel.tsx';

function Floor({ isOpen = true, count = 3 }: { isOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(isOpen);
  return (
    <DockedPanel title="Requests" count={count} isOpen={open} onToggle={() => setOpen(!open)} panel={<p>Ritika Bhalla</p>}>
      <h1>Live floor</h1>
    </DockedPanel>
  );
}

describe('DockedPanel', () => {
  it('shows the screen beside the open panel, named, with its count and what it holds', () => {
    renderIn(<Floor />);
    expect(screen.getByRole('heading', { name: 'Live floor' })).toBeInTheDocument();
    const panel = screen.getByRole('complementary', { name: 'Requests' });
    expect(panel).toHaveClass('w-dock', 'hidden', 'medium:block');
    expect(panel).toHaveTextContent('3');
    expect(screen.getByText('Ritika Bhalla').parentElement).toHaveAttribute('aria-live', 'polite');
  });

  it('folds to a strip with its count, and opens again from the strip', async () => {
    renderIn(<Floor />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.getByRole('complementary', { name: 'Requests' })).toHaveClass('w-dock-strip');
    expect(screen.queryByText('Ritika Bhalla')).not.toBeInTheDocument();
    const strip = screen.getByRole('button', { name: 'Open, 3 waiting' });
    expect(strip).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(strip);
    expect(screen.getByText('Ritika Bhalla')).toBeInTheDocument();
  });

  it('folds and opens from the keyboard', async () => {
    renderIn(<Floor isOpen={false} />);
    screen.getByRole('button', { name: 'Open, 3 waiting' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('draws the folded count in gold only while something waits', () => {
    const { unmount } = renderIn(<Floor isOpen={false} count={2} />);
    expect(screen.getByText('2', { selector: 'span' })).toHaveClass('bg-action');
    unmount();
    renderIn(<Floor isOpen={false} count={0} />);
    expect(screen.getByText('0', { selector: 'span' })).toHaveClass('bg-subtle-hover');
  });

  it('has no accessibility violations, open or folded', async () => {
    const { container, unmount } = renderIn(<Floor />);
    expect(await axeViolations(container)).toEqual([]);
    unmount();
    const folded = renderIn(<Floor isOpen={false} />);
    expect(await axeViolations(folded.container)).toEqual([]);
  });
});
