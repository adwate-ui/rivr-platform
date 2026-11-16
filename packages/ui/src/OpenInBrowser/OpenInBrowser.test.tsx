import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../Toast/Toast.tsx';
import { OpenInBrowser } from './OpenInBrowser.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL_HERE = 'https://app.rivr.test/sign-in';
const WHY = 'Sign in there, so you stay signed in.';

function renderOpen(platform: 'iphone' | 'android', onContinue = vi.fn()) {
  render(<ToastProvider place="player"><OpenInBrowser browser={{ app: 'instagram', platform }} url={URL_HERE} why={WHY} onContinue={onContinue} /></ToastProvider>);
  return onContinue;
}

describe('OpenInBrowser', () => {
  it('sends an iPhone to Safari: why in the app\'s words, how, and the link to copy', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderOpen('iphone');
    expect(screen.getByRole('heading', { name: 'Open RIVR in Safari' })).toBeInTheDocument();
    expect(screen.getByText(WHY)).toBeInTheDocument();
    expect(screen.getByText('Tap ••• at the top, then Open in browser.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_HERE));
    expect(await screen.findByText('Link copied.')).toBeInTheDocument();
  });

  it('says so when the link could not be copied', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: async () => { throw new Error('denied'); } } });
    renderOpen('iphone');
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Not copied. Use the ••• menu.')).toBeInTheDocument();
  });

  it('opens Chrome itself on Android', () => {
    renderOpen('android');
    expect(screen.getByRole('heading', { name: 'Open RIVR in Chrome' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Chrome' })).toHaveAttribute('href', expect.stringMatching(/^intent:\/\/app\.rivr\.test\/sign-in#Intent;/));
  });

  it('lets a wrong guess continue here, from the keyboard too', async () => {
    const onContinue = renderOpen('iphone');
    screen.getByRole('button', { name: 'Continue here' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
