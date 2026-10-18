import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DriverShell } from './DriverShell.tsx';

function renderShell(onArrived = vi.fn()) {
  return renderIn(
    <DriverShell
      title="Pickups"
      banner={<p>Offline.</p>}
      footer={
        <Button variant="primary" fullWidth onClick={onArrived}>
          Arrived
        </Button>
      }
    >
      <p>Sector 65 · 22:40</p>
    </DriverShell>,
  );
}

describe('DriverShell', () => {
  it('titles the screen with a level-one heading and holds it in main', () => {
    renderShell();
    expect(screen.getByRole('heading', { level: 1, name: 'Pickups' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Sector 65 · 22:40');
    expect(screen.getByText('Offline.')).toBeInTheDocument();
  });

  it('pins the next action at the bottom, reachable by keyboard', async () => {
    const onArrived = vi.fn();
    renderShell(onArrived);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Arrived' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onArrived).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
