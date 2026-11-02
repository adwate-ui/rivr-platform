import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PickerSheet } from './PickerSheet.tsx';

const GAMES = ["Hold'em", 'PLO', 'Bomb pots'].map((label) => ({ value: label, label }));

function Games({ mode }: { mode: 'one' | 'many' }) {
  const [selected, setSelected] = useState<string[]>([]);
  return <PickerSheet label="Games you play" options={GAMES} mode={mode} selected={selected} onChange={setSelected} placeholder="Select any" />;
}

describe('PickerSheet', () => {
  it('shows its label and placeholder in the field, and opens a sheet named by the label', async () => {
    renderIn(<Games mode="one" />);
    const field = screen.getByRole('button', { name: /Games you play/ });
    expect(field).toHaveTextContent('Select any');
    await userEvent.click(field);
    expect(screen.getByRole('dialog', { name: 'Games you play' })).toHaveTextContent('Choose one');
  });

  it('closes as one option is picked, and shows it', async () => {
    renderIn(<Games mode="one" />);
    await userEvent.click(screen.getByRole('button', { name: /Games you play/ }));
    await userEvent.click(screen.getByRole('button', { name: 'PLO' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Games you play/ })).toHaveTextContent('PLO');
  });

  it('takes several until Done, comma-joined', async () => {
    renderIn(<Games mode="many" />);
    await userEvent.click(screen.getByRole('button', { name: /Games you play/ }));
    await userEvent.click(screen.getByRole('button', { name: "Hold'em" }));
    await userEvent.click(screen.getByRole('button', { name: 'Bomb pots' }));
    expect(screen.getByRole('button', { name: 'Bomb pots' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: /Games you play/ })).toHaveTextContent("Hold'em, Bomb pots");
  });

  it('says what is wrong under the field', () => {
    renderIn(<PickerSheet label="Occupation" options={GAMES} selected={[]} onChange={vi.fn()} placeholder="Select" error="Select your occupation." />);
    expect(screen.getByRole('button', { name: /Occupation/ })).toHaveAccessibleDescription('Select your occupation.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Games mode="many" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
