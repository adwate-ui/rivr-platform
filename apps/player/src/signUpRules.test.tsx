import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from './router.tsx';

// A screen loaded on first use takes longer than the default second on a busy machine.
const LAZY_SCREEN = { timeout: 5000 };

beforeEach(() => {
  localStorage.setItem('rivr.cookies', JSON.stringify({ maps: false, analytics: false }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Opens sign-up as a number signed in that is not a member yet: no member record, an empty list to all else. */
function renderSignUp() {
  const user = { id: '00000000-0000-4000-8000-000000000202', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => Response.json(String(input instanceof Request ? input.url : input).includes('/rest/v1/member') ? null : []));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ['/sign-up'] }))} />
    </RivrDataProvider>,
  );
}

describe('what the sign-up form takes as a name and a city (issue 1006)', () => {
  it('takes commas and digits in a city that starts with a letter or digit, and neither in a name', async () => {
    renderSignUp();
    const name = await screen.findByRole('textbox', { name: 'Full name, as on Aadhaar' }, LAZY_SCREEN);
    const city = screen.getByRole('textbox', { name: 'City' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' }).getAttribute('aria-busy')).toBeNull());
    // The occupation is left empty throughout, so nothing is sent; each pair turns both fields from the answer before.
    const typing = async (typedName: string, typedCity: string, isRefused: boolean) => {
      fireEvent.change(name, { target: { value: typedName } });
      fireEvent.change(city, { target: { value: typedCity } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      const wanted = isRefused ? 'true' : null;
      await waitFor(() => expect([name.getAttribute('aria-invalid'), city.getAttribute('aria-invalid')]).toEqual([wanted, wanted]));
    };
    await typing('Asha Verma 2', ', Gurugram', true);
    expect(screen.getByText('Use English letters only, as on Aadhaar.')).toBeDefined();
    expect(screen.getByText('Enter your city.')).toBeDefined();
    await typing('Asha Verma', 'Gurugram, Haryana', false);
    await typing('Verma, Asha', 'Gurugram (Haryana)', true);
    await typing('Asha Verma', 'Sector 65', false);
    await typing('.Asha', '-Gurugram', true);
    await typing('Asha Verma', '122018 Gurugram', false);
    expect(screen.getByText('Select your occupation.')).toBeDefined();
  });
});
