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
    expect(screen.getByRole('radiogroup', { name: 'Games you play' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'PLO' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Games you play/ })).toHaveTextContent('PLO');
  });

  it('makes its radios one stop for Tab, moved along by the arrow keys without closing, and chosen by Enter', async () => {
    renderIn(<Games mode="one" />);
    await userEvent.click(screen.getByRole('button', { name: /Games you play/ }));
    const holdem = screen.getByRole('radio', { name: "Hold'em" });
    const plo = screen.getByRole('radio', { name: 'PLO' });
    const bomb = screen.getByRole('radio', { name: 'Bomb pots' });
    expect([holdem.tabIndex, plo.tabIndex, bomb.tabIndex]).toEqual([0, -1, -1]);
    holdem.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(plo).toHaveFocus();
    expect([holdem.tabIndex, plo.tabIndex, bomb.tabIndex]).toEqual([-1, 0, -1]);
    await userEvent.keyboard('{End}');
    expect(bomb).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(holdem).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(plo).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Games you play' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
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

  it('edges the field in the control colour, as the inset field beside it (F-162)', () => {
    renderIn(<PickerSheet label="Occupation" options={GAMES} selected={[]} onChange={vi.fn()} placeholder="Select" />);
    expect(screen.getByRole('button', { name: /Occupation/ })).toHaveClass('border-control');
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
