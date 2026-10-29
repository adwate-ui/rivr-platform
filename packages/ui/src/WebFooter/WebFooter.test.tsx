import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { WebFooter } from './WebFooter.tsx';

const COLUMNS = [
  { heading: 'Policies', links: [{ label: 'House rules', href: '/house-rules' }, { label: 'Privacy', href: '/privacy' }] },
  { heading: 'Need to talk?', links: [{ label: 'Tele-MANAS 14416 (24 hours)', href: 'tel:14416' }] },
];

function renderFooter(cookieSettings?: string) {
  return renderIn(
    <WebFooter address="Glaza, M3M 65th Avenue, Gurugram" notice="Strictly 18+. Poker is a game of skill." columns={COLUMNS}
      copyright="Copyright 2026 RIVR Poker Club" cookieSettings={cookieSettings} />,
  );
}

describe('WebFooter', () => {
  it('says where the club is, its columns of links under their headings, its 18+ line and copyright', () => {
    renderFooter();
    expect(screen.getByText('Glaza, M3M 65th Avenue, Gurugram')).toBeInTheDocument();
    const policies = screen.getByRole('navigation', { name: 'Policies' });
    expect(within(policies).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/house-rules', '/privacy']);
    expect(screen.getByRole('link', { name: 'Tele-MANAS 14416 (24 hours)' })).toHaveAttribute('href', 'tel:14416');
    expect(screen.getByText('Strictly 18+. Poker is a game of skill.')).toBeInTheDocument();
    expect(screen.getByText('Copyright 2026 RIVR Poker Club')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens the cookie choices again from its button, when the website has them', () => {
    renderFooter('Cookie settings');
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toHaveAttribute('data-cookie-settings');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderFooter('Cookie settings');
    expect(await axeViolations(container)).toEqual([]);
  });
});
