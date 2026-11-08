import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { QrScanView } from './QrScanView.tsx';

const HELP = 'Open RIVR › Card, brightness up. Hold it here.';

describe('QrScanView', () => {
  it('says what to do, and announces what the last scan did', () => {
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined} onScannerCode={() => undefined}
      result={{ title: 'Welcome, Kavya.', detail: 'You are checked in.', isRefused: false }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hold your RIVR card up to the camera' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Welcome, Kavya.You are checked in.');
  });

  it('says when the camera cannot start, and nothing between scans', () => {
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined} onScannerCode={() => undefined} cameraError="The camera is not available." />);
    expect(screen.getByText('The camera is not available.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says where the card is between scans, outside the status region, and not while a result shows (F-145)', () => {
    const view = (result?: { title: string; isRefused: boolean }) => (
      <QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined}
        onScannerCode={() => undefined} result={result} />
    );
    const { rerender } = renderIn(view());
    expect(screen.getByText(HELP)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(view({ title: 'Welcome, Kavya.', isRefused: false }));
    expect(screen.queryByText(HELP)).toBeNull();
  });

  it('tells a check-in from a refusal from a step away: a tick in cream, or an alert on a red-edged panel (F-143)', () => {
    const view = (title: string, isRefused: boolean) => (
      <QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined}
        onScannerCode={() => undefined} result={{ title, isRefused }} />
    );
    const { rerender } = renderIn(view('Welcome, Kavya.', false));
    const welcomed = screen.getByText('Welcome, Kavya.');
    expect(welcomed).not.toHaveClass('text-money');
    expect(welcomed.parentElement).not.toHaveClass('border-alert');
    expect(welcomed.parentElement?.querySelector('[class*="bg-gold"] svg')).not.toBeNull();
    rerender(view('Not yet, Vihaan.', true));
    const refused = screen.getByText('Not yet, Vihaan.');
    expect(refused.parentElement).toHaveClass('border-alert');
    expect(refused).toHaveClass('wrap-anywhere');
    expect(refused.parentElement?.querySelector('svg')).not.toBeNull();
    expect(refused.parentElement?.querySelector('[class*="bg-gold"]')).toBeNull();
  });

  it('mirrors the front camera, so a card moves the way the hand does (F-145)', () => {
    const { container } = renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera"
      onRetryCamera={() => undefined} onScannerCode={() => undefined} />);
    expect(container.querySelector('video')).toHaveClass('-scale-x-100');
  });

  it('offers to try the camera again, and hands the focus back to the card scanner (F-145)', () => {
    const onRetryCamera = vi.fn();
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={onRetryCamera}
      onScannerCode={() => undefined} cameraError="The camera is not available." />);
    const retry = screen.getByRole('button', { name: 'Retry camera' });
    retry.focus();
    fireEvent.click(retry);
    expect(onRetryCamera).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Card scanner' })).toHaveFocus();
  });

  it('hears a card scanner: the code it types, on Enter, then an empty field', () => {
    const onScannerCode = vi.fn();
    renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined} onScannerCode={onScannerCode} />);
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
      scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined} onScannerCode={() => undefined} /></main></>);
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
    const { container } = renderIn(<QrScanView videoRef={null} prompt="Hold your RIVR card up to the camera" scannerLabel="Card scanner" help={HELP} retryCameraLabel="Retry camera" onRetryCamera={() => undefined} onScannerCode={() => undefined}
      result={{ title: 'Not yet, Vihaan.', detail: 'Your call time has 25 min left.', isRefused: true }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
