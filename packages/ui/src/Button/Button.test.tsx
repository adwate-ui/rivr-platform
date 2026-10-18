import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Button } from './Button.tsx';

describe('Button', () => {
  it('is a button named by its label that responds to a click', async () => {
    const onClick = vi.fn();
    renderIn(<Button onClick={onClick}>Withdraw</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('can be reached with Tab and pressed with Enter or Space', async () => {
    const onClick = vi.fn();
    renderIn(<Button onClick={onClick}>Join</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Join' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('is a plain button, not a submit, unless asked', () => {
    renderIn(<Button>Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
  });

  it('fills the primary action gold and keeps a 44 px target', () => {
    renderIn(<Button variant="primary">Seat</Button>);
    expect(screen.getByRole('button', { name: 'Seat' })).toHaveClass('bg-action', 'text-on-action', 'min-h-touch', 'min-w-touch');
  });

  it('ignores presses while loading and says so, keeping focus', async () => {
    const onClick = vi.fn();
    renderIn(
      <Button onClick={onClick} isLoading>
        Log hand
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Loading' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
  });

  it('cannot be pressed when disabled', async () => {
    const onClick = vi.fn();
    renderIn(
      <Button onClick={onClick} isDisabled>
        Approve
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no accessibility violations in any variant', async () => {
    const { container } = renderIn(
      <>
        <Button variant="primary">Seat</Button>
        <Button variant="secondary">Skip</Button>
        <Button variant="text">Leave</Button>
        <Button variant="danger" icon="alert">
          Freeze venue
        </Button>
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
