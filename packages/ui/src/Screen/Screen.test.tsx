import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Screen, TitleCount } from './Screen.tsx';

describe('Screen', () => {
  it('shows its title, then its tabs, then the tab’s own screen, whose title is heard but not shown again', () => {
    renderIn(
      <Screen title="Door" tabs={<nav aria-label="Door">Check-in</nav>}>
        <Screen title="Check-in" actions={<button type="button">Scan</button>}>
          <p>Expected</p>
          <Screen level={2} title="In the room"><p>Nobody</p></Screen>
        </Screen>
      </Screen>,
    );
    const door = screen.getByRole('heading', { name: 'Door', level: 1 });
    const tabs = screen.getByRole('navigation', { name: 'Door' });
    const part = screen.getByRole('heading', { name: 'Check-in', level: 2 });
    expect(door.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabs.compareDocumentPosition(part) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(part).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: 'Scan' })).toBeVisible();
    // A screen inside the part is its own again, as the part has no tabs.
    expect(screen.getByRole('heading', { name: 'In the room', level: 2 })).not.toHaveClass('sr-only');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('heads a part of a screen under its tabs at the second level', () => {
    renderIn(<Screen level={2} title="Tablets"><p>Table 1</p></Screen>);
    expect(screen.getByRole('heading', { name: 'Tablets', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tablets' })).toContainElement(screen.getByText('Table 1'));
  });

  it('is a region named by its level-one heading, showing its content when ready', () => {
    renderIn(
      <Screen title="Sessions">
        <p>Table 3 · 4 hours</p>
      </Screen>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sessions' })).toHaveTextContent('Table 3 · 4 hours');
  });

  it('announces loading and marks itself busy', () => {
    renderIn(<Screen title="Balance" status="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByRole('region', { name: 'Balance' })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the one-line empty state instead of content', () => {
    renderIn(
      <Screen title="Sessions" status="empty" emptyText="No sessions yet.">
        <p>Never shown</p>
      </Screen>,
    );
    expect(screen.getByText('No sessions yet.')).toBeInTheDocument();
    expect(screen.queryByText('Never shown')).not.toBeInTheDocument();
  });

  it('offers the one thing to do when it is empty, on the console (console v3)', async () => {
    const onClick = vi.fn();
    renderIn(<Screen title="Tables" status="empty" emptyText="No tables yet." emptyAction={{ label: 'Add a table', onClick }} />);
    expect(screen.getByText('No tables yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a table' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('loads a console list as faint rows, saying so to a screen reader only (console v3)', () => {
    const { container } = renderIn(<Screen title="Members" status="loading" loadingLook="rows" />);
    expect(screen.getByText('Loading')).toHaveClass('sr-only');
    expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(6);
  });

  it('draws a serif-titled screen\u2019s failure in the same face (F-176)', () => {
    renderIn(<Screen title="Card" titleLook="serif" status="error" />);
    expect(screen.getByRole('heading', { name: 'Could not load' })).toHaveClass('font-display');
    expect(screen.getByRole('alert')).toHaveTextContent('Check your connection and try again.');
  });

  it('alerts the error and retries on request', async () => {
    const onRetry = vi.fn();
    renderIn(<Screen title="Balance" status="error" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not loaded. Try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations in the error state', async () => {
    const { container } = renderIn(<Screen title="Balance" status="error" errorText="Balance not loaded." onRetry={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('names the page after the screen and takes the focus to its heading, so a keyboard starts there (F5-03)', () => {
    renderIn(<Screen title="Check-in">content</Screen>);
    expect(document.title).toBe('Check-in · RIVR');
    expect(screen.getByRole('heading', { level: 1, name: 'Check-in' })).toHaveFocus();
  });

  it('starts the page name with the urgent count waiting for staff, and drops it at none (decision 0301)', () => {
    const { rerender } = renderIn(<TitleCount count={3}><Screen title="Top-ups">content</Screen></TitleCount>);
    expect(document.title).toBe('(3) Top-ups · RIVR');
    rerender(<TitleCount count={0}><Screen title="Top-ups">content</Screen></TitleCount>);
    expect(document.title).toBe('Top-ups · RIVR');
  });

  it('leaves the focus on a field the screen focuses itself, such as the door\u2019s scanner field', () => {
    renderIn(<Screen title="Check-in"><input aria-label="Membership card" autoFocus /></Screen>);
    expect(screen.getByRole('textbox', { name: 'Membership card' })).toHaveFocus();
  });

  it('leaves the focus in a menu the person has open when a screen opens behind it, as on a switch to the practice venue', () => {
    function Page({ isScreenShown }: { isScreenShown: boolean }) {
      return (
        <>
          <button type="button" aria-expanded="true" aria-controls="account">Sana Qureshi</button>
          <div id="account" role="group" aria-label="Sana Qureshi"><button type="button">Practice venue</button></div>
          {isScreenShown ? <Screen title="Live floor">content</Screen> : null}
        </>
      );
    }
    const { rerender } = renderIn(<Page isScreenShown={false} />);
    screen.getByRole('button', { name: 'Practice venue' }).focus();
    rerender(<Page isScreenShown />);
    expect(screen.getByRole('button', { name: 'Practice venue' })).toHaveFocus();
  });

  it('gives a part of the screen an element at the title row’s end, as the Members table draws its Export there', () => {
    let slot: HTMLDivElement | null = null;
    renderIn(<Screen title="Members" onActionsSlot={(element) => { slot = element; }}>content</Screen>);
    const title = screen.getByRole('heading', { level: 1, name: 'Members' });
    expect(slot).not.toBeNull();
    expect(title.parentElement).toContainElement(slot);
  });

  it('as a section of another screen, names nothing and takes no focus', () => {
    document.title = 'RIVR';
    renderIn(<Screen title="Tonight" level={2}>content</Screen>);
    expect(document.title).toBe('RIVR');
    expect(screen.getByRole('heading', { level: 2, name: 'Tonight' })).not.toHaveFocus();
  });

  it('gives the page its title back when the screen goes, as for the sign-in steps, which are no screen', () => {
    document.title = 'RIVR';
    const { unmount } = renderIn(<Screen title="Cage">content</Screen>);
    expect(document.title).toBe('Cage · RIVR');
    unmount();
    expect(document.title).toBe('RIVR');
  });

  it('sets a serif title, hides it for a screen headed otherwise, and loads as a skeleton (decision 0320)', () => {
    const { rerender } = renderIn(<Screen title="Sessions" titleLook="serif" status="loading" loadingLook="skeleton" />);
    expect(screen.getByRole('heading', { name: 'Sessions' })).toHaveClass('font-display', 'text-36');
    expect(screen.queryByText('Loading')).toHaveClass('sr-only');
    rerender(<Screen title="Tonight" isTitleHidden>x</Screen>);
    expect(screen.getByRole('heading', { name: 'Tonight' })).toHaveClass('sr-only');
  });
});

describe('Screen on the console', () => {
  const inConsole = (element: ReactElement) => renderIn(<ConsoleFrameContext value>{element}</ConsoleFrameContext>);

  it('holds the title row at one height from 768 px, with or without actions (audit F-101)', () => {
    const { unmount } = inConsole(<Screen title="Service">x</Screen>);
    expect(screen.getByRole('heading', { name: 'Service' }).parentElement).toHaveClass('medium:min-h-touch');
    unmount();
    inConsole(<Screen title="Floor" actions={<button type="button">New order</button>}>x</Screen>);
    expect(screen.getByRole('heading', { name: 'Floor' }).parentElement).toHaveClass('medium:min-h-touch');
  });

  it("stands a tab's action in the title row over the tabs, its own title heard only (audit F-028)", () => {
    inConsole(<Screen title="Rewards" tabs={<nav aria-label="Tabs" />}><Screen title="Catalogue" actions={<button type="button">New reward</button>}>x</Screen></Screen>);
    const row = screen.getByRole('heading', { name: 'Rewards', level: 1 }).parentElement;
    expect(row).toContainElement(screen.getByRole('button', { name: 'New reward' }));
    expect(screen.getByRole('heading', { name: 'Catalogue', level: 2 })).toHaveClass('sr-only');
  });

  it('shows a section heading on a phone; only a screen of its own leaves its title to the header', () => {
    inConsole(<Screen level={2} title="Tables" actions={<button type="button">New table</button>}>x</Screen>);
    expect(screen.getByRole('heading', { name: 'Tables', level: 2 })).not.toHaveClass('max-medium:sr-only');
  });
});
