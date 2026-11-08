import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '../Switch/Switch.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { AccountMenu, AccountMenuRow, initialsOf } from './AccountMenu.tsx';

function menu(onSignOut = vi.fn()) {
  return (
    <>
      <AccountMenu name="Vikram Rao" detail="Super admin · RIVR Gurugram" shortcuts={[{ keys: '/', label: 'Search' }, { keys: 'Esc', label: 'Close' }]}
        signOut={{ label: 'Sign out', onPress: onSignOut }}>
        <AccountMenuRow label="Density"><span>Comfortable</span></AccountMenuRow>
        <Switch label="Practice venue" isOn={false} onChange={vi.fn()} />
      </AccountMenu>
      <button type="button">Elsewhere</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'VR, Vikram Rao' });

describe('AccountMenu', () => {
  it('is a round button with the initials, named for who is signed in, shut at first', () => {
    renderIn(menu());
    expect(trigger()).toHaveTextContent('VR');
    // Named from the initials it shows, then whose they are (WCAG 2.5.3).
    expect(trigger()).toHaveAccessibleName('VR, Vikram Rao');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveClass('size-touch', 'tablet:size-control');
    expect(screen.queryByText('Super admin · RIVR Gurugram')).not.toBeInTheDocument();
  });

  it('opens on a press with the name, role and venue, the settings, the shortcuts and Sign out, the focus inside', async () => {
    renderIn(menu());
    await userEvent.click(trigger());
    const panel = screen.getByRole('group', { name: 'Vikram Rao' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveFocus();
    expect(screen.getByText('Super admin · RIVR Gurugram')).toBeInTheDocument();
    expect(screen.getByText('Density')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Practice venue' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Shortcuts' })).toHaveTextContent('/SearchEscClose');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('signs out from its last line', async () => {
    const onSignOut = vi.fn();
    renderIn(menu(onSignOut));
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('closes on Escape back to its button', async () => {
    renderIn(menu());
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Vikram Rao' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('closes when the focus goes elsewhere, and stays open while it moves inside', async () => {
    renderIn(menu());
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('switch', { name: 'Practice venue' }));
    expect(screen.getByRole('group', { name: 'Vikram Rao' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('group', { name: 'Vikram Rao' })).not.toBeInTheDocument();
  });

  it('opens from the keyboard', async () => {
    renderIn(menu());
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('group', { name: 'Vikram Rao' })).toHaveFocus();
  });

  it('takes the first and last initials, and one for a single name', () => {
    expect(initialsOf('Vikram Rao')).toBe('VR');
    expect(initialsOf('  sana  ali qureshi ')).toBe('SQ');
    expect(initialsOf('Pema')).toBe('P');
  });

  it('has no accessibility violations, open', async () => {
    const { container } = renderIn(menu());
    await userEvent.click(trigger());
    expect(await axeViolations(container)).toEqual([]);
  });
});
