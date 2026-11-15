import { documents, registerMessages } from '@rivr/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { OfflinePackDocument } from './OfflinePackDocument.tsx';
import { PACK } from './offlinePack.fixture.ts';

registerMessages({ documents });

describe('OfflinePackDocument', () => {
  it('has who to call and the floor, each under its heading', async () => {
    const { container } = renderIn(<OfflinePackDocument pack={PACK} />);
    expect(screen.getByRole('article', { name: 'Offline pack' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(['Who to call', 'The floor']);
    expect(screen.getByRole('table', { name: 'Who to call' })).toHaveTextContent('Glaza front desk · Ask for the duty manager');
    expect(screen.getByRole('table', { name: 'Who sits at Table 3' })).toHaveTextContent('Mihir Shah (1042)');
    // Each place names the table whose list it is on (decision 0467).
    expect(screen.getByRole('table', { name: 'Waitlist' })).toHaveTextContent('Table 3NLH 100/2001Ritika Das (1051)');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says so where there is nothing to list', () => {
    renderIn(<OfflinePackDocument pack={{ ...PACK, contacts: [], tables: [], waitlist: [] }} />);
    for (const line of ['No table was open.', 'Nobody waiting.']) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText('No contacts are set.')).toBeInTheDocument();
  });
});
