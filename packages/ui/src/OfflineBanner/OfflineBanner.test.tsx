import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { OfflineBanner } from './OfflineBanner.tsx';

function goOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

describe('OfflineBanner', () => {
  afterEach(() => goOnline(true));

  it('shows nothing while online', () => {
    goOnline(true);
    const { container } = renderIn(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the app is offline while it is, and goes when the connection returns', () => {
    renderIn(<OfflineBanner />);
    act(() => goOnline(false));
    expect(screen.getByRole('status')).toHaveTextContent('Offline. What you see may be out of date.');
    act(() => goOnline(true));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    goOnline(false);
    const { container } = renderIn(<OfflineBanner />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
