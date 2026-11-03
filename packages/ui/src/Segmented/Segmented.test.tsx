import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Segmented } from './Segmented.tsx';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
  { value: 'dense', label: 'Dense' },
] as const;

type Density = (typeof DENSITY)[number]['value'];

/** The control as a screen holds it: the chosen value in state. */
function Held({ onChange = () => undefined }: { onChange?: (value: Density) => void }) {
  const [value, setValue] = useState<Density>('comfortable');
  return <Segmented label="Density" options={DENSITY} value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
}

describe('Segmented', () => {
  it('is a radio group named by its label, each option saying whether it is chosen', () => {
    renderIn(<Segmented label="View" options={[{ value: 'summary', label: 'Summary' }, { value: 'seats', label: 'Seats' }]} value="seats" onChange={() => undefined} />);
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Seats' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Summary' })).toHaveAttribute('aria-checked', 'false');
  });

  it('draws the chosen option on the cream track, the rest in cream on the faint fill', () => {
    renderIn(<Segmented label="Density" options={DENSITY} value="compact" onChange={() => undefined} />);
    expect(screen.getByRole('radiogroup')).toHaveClass('bg-subtle', 'rounded-md');
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveClass('bg-cream-track', 'text-content', 'font-medium', 'rounded-sm', 'text-13');
    expect(screen.getByRole('radio', { name: 'Dense' })).toHaveClass('text-content');
    expect(screen.getByRole('radio', { name: 'Dense' })).not.toHaveClass('bg-cream-track');
  });

  it('chooses an option when pressed, and not again when it is already chosen', async () => {
    const onChange = vi.fn();
    renderIn(<Segmented label="Density" options={DENSITY} value="comfortable" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dense' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Comfortable' }));
    expect(onChange.mock.calls).toEqual([['dense']]);
  });

  it('is one stop for Tab, on the chosen option', async () => {
    renderIn(<Segmented label="Density" options={DENSITY} value="compact" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Comfortable' })).toHaveAttribute('tabindex', '-1');
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveFocus();
  });

  it('lets Tab reach the first option when none is chosen', () => {
    const options: { value: string; label: string }[] = [...DENSITY];
    renderIn(<Segmented label="Density" options={options} value="other" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Comfortable' })).toHaveAttribute('tabindex', '0');
  });

  it('moves and chooses with the arrow keys, wrapping at either end', async () => {
    const onChange = vi.fn();
    renderIn(<Held onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Comfortable' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Dense' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
    expect(onChange.mock.calls).toEqual([['compact'], ['dense'], ['comfortable'], ['dense'], ['compact']]);
  });

  it('goes to the first and last options with Home and End', async () => {
    renderIn(<Held />);
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Dense' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Dense' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Comfortable' })).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps a 44 px target below 1180 px, 32 px segments at a desk, or 28 px when small', () => {
    const { rerender } = renderIn(<Segmented label="Density" options={DENSITY} value="compact" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Dense' })).toHaveClass('min-h-touch', 'tablet:min-h-8', 'leading-control', 'items-center');
    rerender(<Segmented label="Density" size="small" options={DENSITY} value="compact" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Dense' })).toHaveClass('min-h-touch', 'tablet:min-h-7');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Segmented label="Density" options={DENSITY} value="compact" onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
