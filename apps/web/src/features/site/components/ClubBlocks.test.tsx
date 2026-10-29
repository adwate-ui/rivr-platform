import type { SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData, SiteRules } from '@rivr/db/site';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SitePage } from './SitePage.tsx';

afterEach(cleanup);

const NO_RULES: SiteRules = {
  pointsPerHour: [], rakebackBasisPoints: [], hotelNightHours: [], rewardsRakeShareBasisPoints: null, cabVisits: null, leaguePrizes: { month: null, season: null },
};

const LEAGUE: SiteBlock = { kind: 'league', content: { heading: 'The RIVR League' } };
const REWARDS: SiteBlock = { kind: 'rewards', content: { heading: 'Points for every hour' } };
const OUTSTATION: SiteBlock = { kind: 'outstation', content: { eyebrow: 'Outstation', heading: 'Getting here' } };

const PAGE: SitePageData = {
  slug: 'leaderboard', title: 'Leaderboard', description: null, navigation: [], games: [], tournaments: [], promotions: [], wallPosts: [], isPaused: false,
  league: { month: null, season: null }, rules: NO_RULES, blocks: [LEAGUE, REWARDS, OUTSTATION],
};

function renderPage(page: Partial<SitePageData>) {
  return render(<SitePage page={{ ...PAGE, ...page }} playerUrl="https://player.invalid" attribution={null} />);
}

describe('the blocks read from the League and the club’s rules', () => {
  it('shows this month’s and this season’s standings, names as the TVs show them, with each prize from league.prizes', () => {
    renderPage({
      league: {
        month: { first: '2026-11-01', standings: [{ place: 1, name: 'Zoya K.', points: 1200 }, { place: 2, name: null, points: 800 }] },
        season: { name: 'Winter 2026', standings: [] },
      },
      rules: { ...NO_RULES, leaguePrizes: { month: 'Top three win a seat in the season final', season: null } },
    });
    const [month] = screen.getAllByRole('table').map((table) => within(table).getAllByRole('row').map((row) => row.textContent));
    expect(month).toEqual(['PlaceMemberPoints', '1Zoya K.1,200', '2A member800']);
    expect(screen.getByText('The standings for November 2026, from cash games and tournaments.')).toBeDefined();
    expect(screen.getByText('Prizes: Top three win a seat in the season final')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Winter 2026' })).toBeDefined();
    expect(screen.getByText('No standings yet. They start with the first night of play.')).toBeDefined();
  });

  it('shows what play earns by table, and RIVR Rewards, from the rules in force', () => {
    renderPage({
      blocks: [REWARDS],
      rules: { ...NO_RULES, pointsPerHour: [{ table: 'NLH 50/100', value: 5 }, { table: 'NLH 100/200', value: 10 }],
        rakebackBasisPoints: [{ table: 'NLH 100/200', value: 1000 }], rewardsRakeShareBasisPoints: 500 },
    });
    expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual([
      'TablePoints an hourRakeback', 'NLH 50/1005None', 'NLH 100/20010' + '10% of your rake',
    ]);
    expect(screen.getByText(/rounded down to a whole point.*Rakeback is paid as bonus each Monday.*RIVR Rewards: 5% of your rake comes back as points\./)).toBeDefined();
  });

  it('shows the cab and hotel nights the club gives, and leaves out a block with no rule set', () => {
    renderPage({ rules: { ...NO_RULES, cabVisits: 4, hotelNightHours: [{ table: 'Private Room', value: 20 }] } });
    expect(screen.getByText('A cab to the club and home again, once you have played 4 times this month.')).toBeDefined();
    expect(screen.getByText('Private Room: a night for every 20 hours played')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Points for every hour' })).toBeNull();
    cleanup();
    renderPage({});
    expect(screen.queryByRole('heading', { name: 'Getting here' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'The RIVR League' })).toBeDefined();
  });
});
