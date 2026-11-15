import type { SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData, SiteRules } from '@rivr/db/site';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SitePage } from './SitePage.tsx';

afterEach(cleanup);

const NO_RULES: SiteRules = { rakebackBasisPoints: [], cabVisits: null };

const REWARDS: SiteBlock = { kind: 'rewards', content: { heading: 'Rakeback' } };
const OUTSTATION: SiteBlock = { kind: 'outstation', content: { eyebrow: 'Outstation', heading: 'Getting here' } };

const PAGE: SitePageData = {
  slug: 'rewards', title: 'Rewards', description: null, navigation: [], games: [], tournaments: [], promotions: [],
  rules: NO_RULES, blocks: [REWARDS, OUTSTATION],
};

function renderPage(page: Partial<SitePageData>) {
  return render(<SitePage page={{ ...PAGE, ...page }} playerUrl="https://player.invalid" attribution={null} contact={{ phone: '+918796580435', whatsapp: '+918796580435' }} />);
}

describe('the blocks read from the club’s rules', () => {
  it('shows the rakeback each table gives and how it is paid, from the rules in force', () => {
    renderPage({ blocks: [REWARDS], rules: { ...NO_RULES, rakebackBasisPoints: [{ table: 'NLH 100/200', value: 1000 }, { table: 'PLO 100/200', value: 250 }] } });
    expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual(['TableRakeback', 'NLH 100/20010% of your rake', 'PLO 100/2002.5% of your rake']);
    expect(screen.getByText('Rakeback is paid as Bonus each Monday.')).toBeDefined();
  });

  it('shows the cab the club gives, and leaves out a block with no rule set', () => {
    renderPage({ rules: { ...NO_RULES, cabVisits: 4 } });
    expect(screen.getByText('A cab to the club and home again, once you have played 4 times this month.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Rakeback' })).toBeNull();
    cleanup();
    renderPage({});
    expect(screen.queryByRole('heading', { name: 'Getting here' })).toBeNull();
  });
});

describe('promotions in grandpokerarena.com’s way', () => {
  const WELCOME: SiteBlock = { kind: 'promotions', content: { heading: 'Welcome offer', only: 'welcome' } };
  const REFERRAL = { title: 'Referral', detail: null, runs: 'Every day', rules: ['Your friend must be new'], questions: [], isWelcome: false };
  const FIRST_VISIT = { title: 'First visit bonus', detail: null, runs: null, rules: [], questions: [{ question: 'Do I claim it?', answer: 'No.' }], isWelcome: true };

  it('shows the welcome offer alone where the block asks for it, and leaves the band out while none runs', () => {
    renderPage({ blocks: [WELCOME], promotions: [REFERRAL, FIRST_VISIT] });
    expect(screen.getByRole('heading', { level: 3, name: 'First visit bonus' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 3, name: 'Referral' })).toBeNull();
    expect(screen.getByText('Do I claim it?')).toBeDefined();
    cleanup();
    renderPage({ blocks: [WELCOME], promotions: [REFERRAL] });
    expect(screen.queryByRole('heading', { name: 'Welcome offer' })).toBeNull();
  });
});
