import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TabletShell } from './TabletShell.tsx';

function renderShell(onEndDown = vi.fn()) {
  return renderIn(
    <TabletShell tableName="Table 3" banner={<p>Offline. 3 hands queued.</p>} actions={<Button onClick={onEndDown}>End of down</Button>}>
      <h1>Hand entry</h1>
    </TabletShell>,
  );
}

describe('TabletShell', () => {
  it('shows the table name, the banner and the screen in main', () => {
    renderShell();
    expect(screen.getByRole('banner')).toHaveTextContent('Table 3');
    expect(screen.getByText('Offline. 3 hands queued.')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Hand entry');
  });

  it('puts its actions first in focus order, at touch size', async () => {
    const onEndDown = vi.fn();
    renderShell(onEndDown);
    await userEvent.tab();
    const action = screen.getByRole('button', { name: 'End of down' });
    expect(action).toHaveFocus();
    expect(action).toHaveClass('min-h-touch');
    await userEvent.keyboard('{Enter}');
    expect(onEndDown).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
