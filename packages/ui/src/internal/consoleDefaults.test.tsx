import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { ChoiceChips } from '../ChoiceChips/ChoiceChips.tsx';
import { Input } from '../Input/Input.tsx';
import { ConsoleFrameContext } from './consoleFrame.ts';

const onConsole = (element: ReactElement) => render(<ConsoleFrameContext value>{element}</ConsoleFrameContext>);
const OPTIONS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe("the console's own defaults (audit F-125)", () => {
  it('fills a button that names no look and sizes it for a desk', () => {
    onConsole(<><Button>Bare</Button><Button variant="subtle" size="compact">Named</Button></>);
    expect(screen.getByRole('button', { name: 'Bare' }).className).toBe(screen.getByRole('button', { name: 'Named' }).className);
  });

  it('leaves a button that names its look alone, and every button off the console', () => {
    onConsole(<><Button variant="primary">Gold</Button><Button variant="primary" size="regular">Regular</Button></>);
    expect(screen.getByRole('button', { name: 'Gold' }).className).toBe(screen.getByRole('button', { name: 'Regular' }).className);
    render(<><Button>Plain</Button><Button variant="secondary" size="regular">Outlined</Button></>);
    expect(screen.getByRole('button', { name: 'Plain' }).className).toBe(screen.getByRole('button', { name: 'Outlined' }).className);
  });

  it('fills chips that name no look', () => {
    onConsole(
      <>
        <ChoiceChips label="Bare" mode="one" options={OPTIONS} selected={[]} onChange={vi.fn()} />
        <ChoiceChips label="Named" look="subtle" mode="one" options={OPTIONS} selected={[]} onChange={vi.fn()} />
      </>,
    );
    const [bare, named] = screen.getAllByRole('radio', { name: 'A' });
    expect(bare?.className).toBe(named?.className);
  });

  it('fills a field that names no look, 36 px at a desk, and keeps its hint', () => {
    onConsole(<Input label="Name" hint="As on their ID." />);
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect(field).toHaveClass('bg-subtle', 'tablet:min-h-control');
    expect(field).toHaveAccessibleDescription('As on their ID.');
  });

  it('keeps a field with a suffix boxed, at the same height at a desk', () => {
    onConsole(<Input label="Minutes" suffix="min" />);
    expect(screen.getByRole('textbox', { name: /Minutes/ })).toHaveClass('tablet:min-h-control');
  });

  it('keeps a field with a placeholder boxed, so its empty words do not read as filled in', () => {
    onConsole(<Input label="From" placeholder="20:00" />);
    const field = screen.getByRole('textbox', { name: 'From' });
    expect(field).not.toHaveClass('bg-subtle');
    expect(field).toHaveClass('tablet:min-h-control');
  });

  it('keeps 16 px field text below 1180 px, so a phone does not zoom in', () => {
    onConsole(<Input label="Name" />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveClass('text-16', 'tablet:text-13');
  });
});
