import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CookieBanner } from './CookieBanner.tsx';

describe('CookieBanner', () => {
  it('is drawn hidden, for the page to open while no choice is stored', () => {
    const { container } = renderIn(<CookieBanner />);
    expect(container.querySelector('[data-cookie-banner]')).toHaveAttribute('hidden');
  });

  it('offers essential storage, always on, and maps and analytics as the visitor’s choice, with a button for each answer', () => {
    renderIn(<CookieBanner isOpen />);
    const banner = screen.getByRole('region', { name: 'Cookies on this website' });
    const essential = within(banner).getByRole('checkbox', { name: /Essential/ });
    expect(essential).toBeChecked();
    expect(essential).toBeDisabled();
    expect(within(banner).getByRole('checkbox', { name: /Maps/ })).not.toBeChecked();
    expect(within(banner).getByRole('checkbox', { name: /Analytics and ads/ })).not.toBeChecked();
    expect(within(banner).getAllByRole('button').map((button) => [button.textContent, button.dataset.consentChoice])).toEqual([
      ['Accept all', 'all'], ['Essential only', 'essential'], ['Save my choices', 'ticked'],
    ]);
  });

  it('in the app, asks about analytics alone and says what each button chose', () => {
    const onChoose = vi.fn();
    renderIn(<CookieBanner isOpen place="app" onChoose={onChoose} />);
    const banner = screen.getByRole('region', { name: 'Cookies in this app' });
    expect(within(banner).queryByRole('checkbox', { name: /Maps/ })).toBeNull();
    fireEvent.click(within(banner).getByRole('button', { name: 'Accept all' }));
    fireEvent.click(within(banner).getByRole('button', { name: 'Essential only' }));
    fireEvent.click(within(banner).getByRole('checkbox', { name: /Analytics and ads/ }));
    fireEvent.click(within(banner).getByRole('button', { name: 'Save my choices' }));
    expect(onChoose.mock.calls).toEqual([[{ maps: false, analytics: true }], [{ maps: false, analytics: false }], [{ maps: false, analytics: true }]]);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CookieBanner isOpen />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
