import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StatusMessage } from './StatusMessage.tsx';

describe('StatusMessage', () => {
  it('is a status, read out politely, with the message as its text', () => {
    renderIn(<StatusMessage>Sent to the bar: KOT 12.</StatusMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('Sent to the bar: KOT 12.');
  });

  it('is in place, empty, before there is anything to say', () => {
    const { rerender } = renderIn(<StatusMessage>{null}</StatusMessage>);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(<StatusMessage>Sent to the bar: KOT 13.</StatusMessage>);
    expect(screen.getByRole('status')).toHaveTextContent('Sent to the bar: KOT 13.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StatusMessage>Sent to the bar: KOT 12, to Table 3, seat 5.</StatusMessage>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
