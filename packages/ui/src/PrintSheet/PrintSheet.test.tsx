import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrintSheet } from './PrintSheet.tsx';

afterEach(cleanup);

describe('PrintSheet', () => {
  it('keeps what it holds off the screen and on the paper', () => {
    render(<PrintSheet><p>Receipt RV-0213-0418</p></PrintSheet>);
    const sheet = screen.getByText('Receipt RV-0213-0418').parentElement;
    expect(sheet).toHaveAttribute('data-print-sheet', 'receipt');
    expect(sheet).toHaveClass('hidden', 'print:block');
  });

  it('prints an A4 document on A4 paper when asked', () => {
    render(<PrintSheet paper="a4"><p>Partner statement</p></PrintSheet>);
    expect(screen.getByText('Partner statement').parentElement).toHaveAttribute('data-print-sheet', 'a4');
  });
});
