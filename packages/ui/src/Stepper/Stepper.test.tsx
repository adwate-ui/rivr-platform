import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Stepper } from './Stepper.tsx';

const STEPS = ['Sent', 'Preparing', 'On its way', 'Delivered'];

describe('Stepper', () => {
  it('lists the steps and marks the one reached as current', () => {
    renderIn(<Stepper steps={STEPS} current={2} label="Order" />);
    const list = screen.getByRole('list', { name: 'Order' });
    expect(list.querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByText('On its way').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Delivered')).toHaveClass('text-content-muted');
    expect(screen.getByText('Sent')).toHaveClass('text-content');
  });

  it('gives each step a column, however many there are (F-177)', () => {
    renderIn(<Stepper steps={['Asked', 'Done']} current={0} label="Request" />);
    expect(screen.getByRole('list', { name: 'Request' }).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Stepper steps={STEPS} current={0} label="Order" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Stepper, the progress look (redesign RD-15)', () => {
  const FLOW = ['Member', 'Face', 'PAN card', 'Aadhaar front', 'Details'];
  const items = () => within(screen.getByRole('list', { name: 'ID check' })).getAllByRole('listitem');
  /** The current step's name under the bars, shown where the names do not all fit. */
  const namedAlone = (name: string) => screen.queryByText(name, { selector: '[aria-hidden="true"]' });

  afterEach(() => { vi.restoreAllMocks(); });

  it('reads the steps in order, those done, the current one and those to come, with one bar each', async () => {
    const { container } = renderIn(<Stepper look="progress" steps={FLOW} current={2} label="ID check" />);
    expect(items().map((item) => item.textContent)).toEqual(['Member, done', 'Face, done', 'PAN card, current step', 'Aadhaar front', 'Details']);
    expect(items().map((item) => item.getAttribute('aria-current'))).toEqual([null, null, 'step', null, null]);
    expect(items().map((item) => item.firstElementChild?.className.match(/bg-[a-z-]+/)?.[0])).toEqual(['bg-gold', 'bg-gold', 'bg-cream', 'bg-cream-track', 'bg-cream-track']);
    expect(screen.getByText('PAN card').parentElement).toHaveClass('font-semibold', 'text-content');
    expect(screen.getByText('Details').parentElement).toHaveClass('text-content-muted');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says the step reached to a screen reader, and the next one as the flow moves on', () => {
    const { rerender } = renderIn(<Stepper look="progress" steps={FLOW} current={2} label="ID check" />);
    expect(screen.getByRole('status')).toHaveTextContent('Step 3 of 5: PAN card');
    rerender(<Stepper look="progress" steps={FLOW} current={3} label="ID check" />);
    expect(screen.getByRole('status')).toHaveTextContent('Step 4 of 5: Aadhaar front');
  });

  it('names every step where the names fit side by side, each column as wide as its name needs', () => {
    renderIn(<Stepper look="progress" steps={FLOW} current={2} label="ID check" />);
    expect(namedAlone('PAN card')).toBeNull();
    expect(screen.getByText('Member').parentElement).not.toHaveClass('opacity-0');
    expect(screen.getByRole('list', { name: 'ID check' }).style.gridTemplateColumns).toBe('repeat(5, minmax(max-content, 1fr))');
  });

  it('names only the current step where they do not fit, and keeps every step in the list', () => {
    // Five names 100 px wide in a bar of 300: jsdom lays nothing out, so the widths are given.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 14));
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    renderIn(<Stepper look="progress" steps={FLOW} current={2} label="ID check" />);
    expect(namedAlone('PAN card')).toBeInTheDocument();
    for (const name of FLOW) expect(screen.getByText(name, { selector: '[data-step-name]' }).parentElement).toHaveClass('opacity-0');
    expect(screen.getByRole('list', { name: 'ID check' }).style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
    expect(items().map((item) => item.textContent)).toEqual(['Member, done', 'Face, done', 'PAN card, current step', 'Aadhaar front', 'Details']);
    expect(screen.getByRole('status')).toHaveTextContent('Step 3 of 5: PAN card');
  });
});
