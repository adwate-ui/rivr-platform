import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Label } from './Label.tsx';

describe('Label', () => {
  it('names the control it points at', () => {
    renderIn(
      <>
        <Label htmlFor="utr">UTR</Label>
        <input id="utr" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'UTR' })).toBeInTheDocument();
  });

  it('focuses the control when clicked', async () => {
    renderIn(
      <>
        <Label htmlFor="amount">Amount</Label>
        <input id="amount" />
      </>,
    );
    await userEvent.click(screen.getByText('Amount'));
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
  });
});
