import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ErrorMessage } from './ErrorMessage.tsx';

describe('ErrorMessage', () => {
  it('is announced as an alert, with the message as its text', () => {
    renderIn(<ErrorMessage>This UTR is already on another booking.</ErrorMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent('This UTR is already on another booking.');
  });

  it('gives the message an id a field can point at', () => {
    renderIn(<ErrorMessage id="utr-error">Enter the 12-digit UTR.</ErrorMessage>);
    expect(screen.getByText('Enter the 12-digit UTR.')).toHaveAttribute('id', 'utr-error');
  });

  it('marks a field error with a red dot instead of the icon in the player app (decision 0320)', () => {
    const { container } = renderIn(<ErrorMessage look="dot">Enter your city.</ErrorMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your city.');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.bg-alert.rounded-full')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ErrorMessage>Not enough seats left in this batch. Choose another batch.</ErrorMessage>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
