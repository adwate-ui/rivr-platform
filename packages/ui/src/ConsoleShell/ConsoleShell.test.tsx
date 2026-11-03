import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consoleSections, consoleTabs } from '../storybook/fixtures.ts';
import { axeViolations, renderIn } from '../test/render.tsx';
import { RAIL_KEY } from './ConsoleRail.tsx';
import { Screen } from '../Screen/Screen.tsx';
import { ConsoleShell } from './ConsoleShell.tsx';

function renderShell(onNavigate = vi.fn()) {
  return renderIn(
    <ConsoleShell sections={consoleSections()} tabs={consoleTabs()} currentItem="members" onNavigate={onNavigate}
      banner={<p>Venue frozen.</p>} search={<button type="button">Search</button>} pulse={<p>23 seated</p>} clock={<p>11:40</p>}
      account={<button type="button">Vikram Rao</button>}>
      <h1>Members</h1>
    </ConsoleShell>,
  );
}

/** A window `width` wide, as matchMedia answers a min-width query. */
function windowOf(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0), addEventListener: () => undefined, removeEventListener: () => undefined,
  }));
}

const rail = () => screen.getByRole('complementary');

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('ConsoleShell', () => {
  it('leaves a screen’s title to the phone’s header below 768 px, heard there and shown from 768 px', () => {
    renderIn(
      <ConsoleShell sections={consoleSections()} currentItem="members">
        <Screen title="Members"><p>No one yet.</p></Screen>
      </ConsoleShell>,
    );
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Members', level: 1 })).toHaveClass('max-medium:sr-only');
    expect(screen.getByRole('banner')).toHaveTextContent('Members');
  });

  it('holds the rail in a complementary landmark, the header in a banner and the screen in main', () => {
    renderShell();
    expect(rail()).toContainElement(screen.getByRole('navigation', { name: 'Sections' }));
    expect(screen.getByRole('main')).toHaveTextContent('Members');
    expect(screen.getByText('Venue frozen.')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    for (const part of ['Search', 'Vikram Rao']) expect(within(header).getByRole('button', { name: part })).toBeInTheDocument();
    expect(header).toHaveTextContent('23 seated');
    expect(header).toHaveTextContent('11:40');
  });

  it('scrolls the screen on its own, focusable, and positioned for its hidden text', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveClass('overflow-y-auto', 'relative');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '0');
  });

  it('groups the rail by the job and marks the current screen', () => {
    renderShell();
    for (const group of ['Tonight', 'Players', 'Marketing']) expect(within(rail()).getByRole('list', { name: group })).toBeInTheDocument();
    expect(within(rail()).getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the rail\'s labels from 1200 px, and folds it to icons below on its own', () => {
    windowOf(1440);
    const { unmount } = renderShell();
    expect(rail()).toHaveClass('w-rail');
    expect(within(rail()).getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
    unmount();
    windowOf(1180);
    renderShell();
    expect(rail()).toHaveClass('w-rail-collapsed');
    expect(within(rail()).getByRole('link', { name: 'Members' })).toHaveAttribute('title', 'Members');
  });

  it('keeps the staff member\'s choice of rail on the device', async () => {
    windowOf(1440);
    const { unmount } = renderShell();
    await userEvent.click(within(rail()).getByRole('button', { name: 'Collapse' }));
    expect(rail()).toHaveClass('w-rail-collapsed');
    expect(window.localStorage.getItem(RAIL_KEY)).toBe('icons');
    unmount();
    renderShell();
    expect(rail()).toHaveClass('w-rail-collapsed');
    await userEvent.click(within(rail()).getByRole('button', { name: 'Expand' }));
    expect(rail()).toHaveClass('w-rail');
  });

  it('still folds the rail when the device refuses storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    renderShell();
    await userEvent.click(within(rail()).getByRole('button', { name: 'Collapse' }));
    expect(rail()).toHaveClass('w-rail-collapsed');
    vi.restoreAllMocks();
  });

  it('names the screen in the phone\'s header, and puts the app\'s tabs and More along the foot', () => {
    renderShell();
    expect(screen.getByRole('banner')).toHaveTextContent('Members');
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['#floor', '#requests', '#waitlist', '#door']);
    expect(within(tabs).getByRole('link', { name: 'Requests', description: '12 waiting' })).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('opens every screen from More, and closes it on choosing one', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const more = screen.getByRole('dialog', { name: 'All screens' });
    await userEvent.click(within(more).getByRole('link', { name: 'Feedback' }));
    expect(onNavigate).toHaveBeenCalledWith('#feedback');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes More with Escape or Close', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('routes rail links through the app', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    await userEvent.click(within(rail()).getByRole('link', { name: 'KYC review' }));
    expect(onNavigate).toHaveBeenCalledWith('#kyc');
  });

  it('starts with Skip to content, which takes the focus to the screen past the rail (F5-03)', async () => {
    renderShell();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
