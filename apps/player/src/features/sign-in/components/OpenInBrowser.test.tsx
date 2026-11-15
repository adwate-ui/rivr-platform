import { ToastProvider } from '@rivr/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenInBrowser } from './OpenInBrowser.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const URL_HERE = 'https://app.rivr.test/sign-in';

function renderOpen(platform: 'iphone' | 'android', onContinue = vi.fn()) {
  render(<ToastProvider place="player"><OpenInBrowser browser={{ app: 'instagram', platform }} url={URL_HERE} onContinue={onContinue} /></ToastProvider>);
  return onContinue;
}

describe('Sign in › Open in your browser', () => {
  it('sends an iPhone to Safari, with how and the link to copy', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderOpen('iphone');
    expect(screen.getByRole('heading', { name: 'Open RIVR in Safari' })).toBeDefined();
    expect(screen.getByText('Tap ••• at the top, then Open in browser.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_HERE));
    expect(await screen.findByText('Link copied.')).toBeDefined();
  });

  it('opens Chrome itself on Android', () => {
    renderOpen('android');
    expect(screen.getByRole('heading', { name: 'Open RIVR in Chrome' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open in Chrome' }).getAttribute('href')).toMatch(/^intent:\/\/app\.rivr\.test\/sign-in#Intent;/);
  });

  it('lets a wrong guess continue here', () => {
    const onContinue = renderOpen('iphone');
    fireEvent.click(screen.getByRole('button', { name: 'Continue here' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
