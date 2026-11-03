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

  it('ignores presses while loading and says so, keeping its label and focus (F5-17)', async () => {
    const onClick = vi.fn();
    renderIn(
      <Button onClick={onClick} isLoading>
        Log hand
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Log hand' });
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

  it('is a link that looks the same when it has an address', () => {
    renderIn(
      <Button variant="primary" href="https://player.invalid/sign-in?ref=FRIEND1">
        Join RIVR
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', 'https://player.invalid/sign-in?ref=FRIEND1');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('as a link, only goes somewhere: it cannot be disabled, loading or pressed', () => {
    renderIn(
      // @ts-expect-error A link cannot be disabled; it would still be followed.
      <Button href="/academy" isDisabled>
        Academy
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Academy' })).toHaveAttribute('href', '/academy');
  });

  it('sets an aside at its right end and the label at its left, the turning circle with the label (owner, 3 Nov)', () => {
    renderIn(
      <>
        <Button variant="primary" fullWidth aside="2 items" isLoading>Send to the bar</Button>
        <Button variant="primary">Join</Button>
      </>,
    );
    const send = screen.getByRole('button', { name: 'Send to the bar 2 items' });
    expect(send).toHaveClass('justify-between');
    expect(send).not.toHaveClass('justify-center');
    // Two ends: the label with its circle, and the aside; never the circle alone at the left.
    expect(send.children).toHaveLength(2);
    expect(send.firstElementChild).toHaveTextContent('Send to the bar');
    expect(send.firstElementChild?.querySelector('[data-busy-turn]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Join' })).toHaveClass('justify-center');
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

  it('is 48 px tall when large, for the one action of a sign-in step, and 44 px otherwise', () => {
    renderIn(
      <>
        <Button variant="primary" size="large">Send code</Button>
        <Button variant="primary">Seat</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Send code' })).toHaveClass('min-h-12', 'font-semibold');
    expect(screen.getByRole('button', { name: 'Seat' })).toHaveClass('min-h-touch');
  });

  it('is 54 px tall when tall, rounds its ends as a pill, and reads out a toggle that is on (decision 0320)', () => {
    renderIn(
      <>
        <Button variant="primary" size="tall">Send code</Button>
        <Button variant="outline" shape="pill" isPressed>Notifying you</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Send code' })).toHaveClass('min-h-action', 'rounded-lg');
    const toggle = screen.getByRole('button', { name: 'Notifying you' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveClass('rounded-full', 'min-h-touch', 'border-accent', 'text-accent');
  });

  it('as a link with a file name, saves what it points at under that name', () => {
    renderIn(<Button href="blob:https://console.invalid/1" download="tds-return.csv">Download the extract</Button>);
    expect(screen.getByRole('link', { name: 'Download the extract' })).toHaveAttribute('download', 'tds-return.csv');
  });

  it('as a link that opens a new tab, keeps the screen and gives the page no hold on it', () => {
    renderIn(<Button href="https://cctv.invalid/playback" opensNewTab>Open the recording</Button>);
    const link = screen.getByRole('link', { name: 'Open the recording' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('as a plain link, opens in place', () => {
    renderIn(<Button href="https://rivr.invalid/">Home</Button>);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('target');
  });
});
