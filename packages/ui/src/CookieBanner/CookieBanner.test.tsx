import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CookieBanner } from './CookieBanner.tsx';

describe('CookieBanner', () => {
  it('is drawn hidden, for the page to open while no choice is stored', () => {
    const { container } = renderIn(<CookieBanner />);
    expect(container.querySelector('[data-cookie-banner]')).toHaveAttribute('hidden');
  });

  it('offers essential storage, always on, and maps as the visitor’s choice, with a button for each answer', () => {
    renderIn(<CookieBanner isOpen />);
    const banner = screen.getByRole('region', { name: 'Cookies on this website' });
    const essential = within(banner).getByRole('checkbox', { name: /Essential/ });
    expect(essential).toBeChecked();
    expect(essential).toBeDisabled();
    expect(within(banner).getByRole('checkbox', { name: /Maps/ })).not.toBeChecked();
    expect(within(banner).queryByRole('checkbox', { name: /Analytics|Marketing/ })).toBeNull();
    expect(within(banner).getAllByRole('button').map((button) => [button.textContent, button.dataset.consentChoice])).toEqual([
      ['Accept all', 'all'], ['Essential only', 'essential'], ['Save my choices', 'ticked'],
    ]);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CookieBanner isOpen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
