import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { QrScanView } from './QrScanView.tsx';

describe('QrScanView', () => {
  it('says what to do, and announces what the last scan did', () => {
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" onScannerCode={() => undefined}
      result={{ title: 'Welcome, Kavya.', detail: 'You are checked in.', isRefused: false }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hold your RIVR card up to the camera' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Welcome, Kavya.You are checked in.');
  });

  it('says when the camera cannot start, and nothing between scans', () => {
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" onScannerCode={() => undefined} cameraError="The camera is not available." />);
    expect(screen.getByText('The camera is not available.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('hears a card scanner: the code it types, on Enter, then an empty field', () => {
    const onScannerCode = vi.fn();
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" onScannerCode={onScannerCode} />);
    const field = screen.getByRole('textbox', { name: 'Card scanner' });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: ' abc.123.def ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onScannerCode).toHaveBeenCalledWith('abc.123.def');
    expect(field).toHaveValue('');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" onScannerCode={() => undefined}
      result={{ title: 'Not yet, Vihaan.', detail: 'Your call time has 25 min left.', isRefused: true }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
