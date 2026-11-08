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

  it('takes the focus back from a tap anywhere, but never traps the keyboard (WCAG 2.1.2)', () => {
    // As the kiosk sits in TabletShell: a skip link, then a main that script can focus but Tab never reaches.
    renderIn(<><a href="#main">Skip to content</a><main tabIndex={-1}><QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera"
      scannerLabel="Card scanner" onScannerCode={() => undefined} /></main></>);
    const field = screen.getByRole('textbox', { name: 'Card scanner' });
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    fireEvent.blur(field, { relatedTarget: skip });
    skip.focus();
    expect(skip).toHaveFocus();
    field.focus();
    fireEvent.blur(field, { relatedTarget: null });
    expect(field).toHaveFocus();
    // A tap on the camera's picture focuses main: the card scanner still needs the field.
    fireEvent.blur(field, { relatedTarget: screen.getByRole('main') });
    expect(field).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" onScannerCode={() => undefined}
      result={{ title: 'Not yet, Vihaan.', detail: 'Your call time has 25 min left.', isRefused: true }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
