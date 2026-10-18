import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { WebShell } from './WebShell.tsx';

const links = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Membership', href: '/membership' },
];

function renderShell(onNavigate = vi.fn()) {
  return renderIn(
    <WebShell links={links} footer={<p>Upper floor, Glaza, M3M 65th Avenue, Gurugram</p>} onNavigate={onNavigate}>
      <h1>Skill runs deep.</h1>
    </WebShell>,
  );
}

describe('WebShell', () => {
  it('has a header, the site navigation, the page in main and a footer', () => {
    renderShell();
    expect(screen.getByRole('banner')).toHaveTextContent('RIVR');
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Tournaments', 'Membership']);
    expect(screen.getByRole('main')).toHaveTextContent('Skill runs deep.');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Gurugram');
  });

  it('links the club name home and routes links through the app', async () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    expect(screen.getByRole('link', { name: 'RIVR Poker Club' })).toHaveAttribute('href', '/');
    await userEvent.click(screen.getByRole('link', { name: 'Membership' }));
    expect(onNavigate).toHaveBeenCalledWith('/membership');
  });

  it('leaves out the footer when there is none', () => {
    renderIn(
      <WebShell links={links}>
        <h1>Tournaments</h1>
      </WebShell>,
    );
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell();
    expect(await axeViolations(container)).toEqual([]);
  });
});
