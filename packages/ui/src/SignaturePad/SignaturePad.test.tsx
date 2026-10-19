import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { SignaturePad } from './SignaturePad.tsx';

describe('SignaturePad', () => {
  it('keeps a stroke as SVG path data, given when the stroke ends', () => {
    const onChange = vi.fn();
    renderIn(<SignaturePad label="Signature of Kunal Mehra" onChange={onChange} />);
    const pad = screen.getByRole('img', { name: 'Signature of Kunal Mehra' });
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^M \d+ \d+ L \d+ \d+$/));
    expect(pad.querySelectorAll('path')).toHaveLength(1);
  });

  it('shows what is signed for, and a signature already given', () => {
    renderIn(<SignaturePad label="Signature of Neel Bose for ₹10,000" defaultValue="M 1 1 L 20 20" onChange={() => undefined} />);
    expect(screen.getByText('Signature of Neel Bose for ₹10,000')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Signature of Neel Bose for ₹10,000' }).querySelectorAll('path')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
  });

  it('clears to start again', () => {
    const onChange = vi.fn();
    renderIn(<SignaturePad label="Signature" onChange={onChange} />);
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(clear).toBeDisabled();
    const pad = screen.getByRole('img', { name: 'Signature' });
    fireEvent.pointerDown(pad, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    fireEvent.click(clear);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(pad.querySelectorAll('path')).toHaveLength(0);
  });
});
