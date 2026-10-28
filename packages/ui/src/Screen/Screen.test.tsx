import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Screen } from './Screen.tsx';

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
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this. Check the connection and try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations in the error state', async () => {
    const { container } = renderIn(<Screen title="Balance" status="error" errorText="Balance not loaded." onRetry={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
