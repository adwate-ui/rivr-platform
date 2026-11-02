import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Screen, TitleCount } from './Screen.tsx';

describe('Screen', () => {
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
});
