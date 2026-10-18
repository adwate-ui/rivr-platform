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

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ErrorMessage>Not enough seats left in this batch. Choose another batch.</ErrorMessage>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
