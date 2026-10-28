import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { consoleSections } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ConsoleShell } from './ConsoleShell.tsx';

function renderShell(onNavigate = vi.fn()) {
  return renderIn(
    <ConsoleShell
      sections={consoleSections()}
      currentItem="cage"
      onNavigate={onNavigate}
      banner={<p>Venue frozen.</p>}
      railFooter={<p>Sana Qureshi</p>}
    >
      <h1>Cage</h1>
    </ConsoleShell>,
  );
}

describe('ConsoleShell', () => {
  it('holds the rail in a complementary landmark and the screen in main', () => {
    renderShell();
    expect(screen.getByRole('complementary')).toContainElement(screen.getByRole('navigation', { name: 'Sections' }));
    expect(screen.getByRole('main')).toHaveTextContent('Cage');
    expect(screen.getByText('Venue frozen.')).toBeInTheDocument();
  });

  it('puts who is signed in at the foot of the rail', () => {
    renderShell();
    expect(screen.getByRole('complementary')).toHaveTextContent('Sana Qureshi');
  });

  it('scrolls the list of screens, not the foot of the rail, so signing out stays in view', () => {
    renderShell();
    const list = screen.getByRole('navigation', { name: 'Sections' }).parentElement;
    expect(list).toHaveClass('overflow-y-auto');
    expect(list).not.toContainElement(screen.getByText('Sana Qureshi'));
    expect(screen.getByRole('main')).toHaveClass('overflow-y-auto');
    // A keyboard can scroll the screen even when it has nothing else to focus.
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '0');
  });

  it('groups the rail by the job and marks the current screen', () => {
    renderShell();
    for (const group of ['Tonight', 'Cage', 'Players', 'Marketing', 'Money', 'Team', 'Reports']) {
      expect(screen.getByRole('list', { name: group })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cage' })).toHaveAttribute('aria-current', 'page');
  });

  it('names the screen in the top bar, whose menu opens the rail and closes on choosing a screen', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    expect(screen.getByRole('banner')).toHaveTextContent('Cage');
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('dialog', { name: 'Sections' });
    expect(within(menu).getByText('Sana Qureshi')).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('link', { name: 'KYC review' }));
    expect(onNavigate).toHaveBeenCalledWith('#kycReview');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // A tap outside closes it too: the Console fits flow taps beside the menu in a real browser.
  it('closes the menu with Escape or its Close button, giving focus back to Menu', async () => {
    renderShell();
    const menu = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(menu);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
    await userEvent.click(menu);
    await userEvent.click(screen.getByRole('button', { name: 'Close the menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it('finds a screen by name with Go to, and Enter opens the first found', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    const rail = screen.getByRole('complementary');
    await userEvent.type(within(rail).getByRole('searchbox', { name: 'Go to' }), 'kyc');
    expect(within(rail).getAllByRole('link').map((link) => link.textContent)).toEqual(['KYC review']);
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('#kycReview');
    await userEvent.type(within(rail).getByRole('searchbox', { name: 'Go to' }), 'zzz');
    expect(within(rail).getByText('No screen by that name.')).toBeInTheDocument();
  });

  it('moves to Go to with Ctrl+K, or / outside a field', async () => {
    renderShell();
    const goTo = within(screen.getByRole('complementary')).getByRole('searchbox', { name: 'Go to' });
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(goTo).toHaveFocus();
    goTo.blur();
    await userEvent.keyboard('/');
    expect(goTo).toHaveFocus();
  });

  it('routes rail links through the app', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    await userEvent.click(screen.getByRole('link', { name: 'KYC review' }));
    expect(onNavigate).toHaveBeenCalledWith('#kycReview');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
