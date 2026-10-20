import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrintSheet } from './PrintSheet.tsx';

afterEach(cleanup);

describe('PrintSheet', () => {
  it('keeps what it holds off the screen and on the paper', () => {
    render(<PrintSheet><p>Receipt RV-0213-0418</p></PrintSheet>);
    const sheet = screen.getByText('Receipt RV-0213-0418').parentElement;
    expect(sheet).toHaveClass('rivr-print-sheet', 'hidden', 'print:block');
  });
});
