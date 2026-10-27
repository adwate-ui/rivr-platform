import type { MisReport } from '@rivr/db/reports';
import type { RegisterRow } from '@rivr/db/shareholding';
import { fromPaise } from '@rivr/domain/money';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PartnerStatements, statementsOf } from './PartnerStatements.tsx';

afterEach(cleanup);

const holder = (name: string, basisPoints: number | null): RegisterRow => ({
  shareholderId: name, name, kind: 'partner', basisPoints, effectiveFrom: basisPoints === null ? null : '2026-01-01',
});
const NOVEMBER: MisReport = {
  month: '2026-11-01', hands: 0, rake: fromPaise(0n), drop: fromPaise(0n), byTable: [], byDealer: [], byVariant: [],
  revenue: [{ code: 'venue.rake', name: 'Rake', amount: fromPaise(300_000n) }],
  expenses: [{ code: 'venue.bonus_expense', name: 'Bonus issued', amount: fromPaise(20_000n) }],
  totalRevenue: fromPaise(300_000n), totalExpenses: fromPaise(20_000n), net: fromPaise(280_000n), visits: 0, members: 0, promotions: [], cohorts: [],
  generatedAt: '2026-12-01T01:30:00Z', isPreview: false,
};
const ISSUER = { legalName: 'RIVR Hospitality LLP', address: 'Sector 65, Gurugram' };

describe('the monthly partner and investor statements', () => {
  it('gives each holder with a holding on the month\'s last day their share, and none to one without or at 0%', () => {
    const statements = statementsOf([holder('Kabir', 1250), holder('Meera', 0), holder('Ravi', null)], NOVEMBER, ISSUER, '2026-11-01');
    expect(statements.map((row) => row.holder.name)).toEqual(['Kabir']);
    expect(statements[0]?.statement).toMatchObject({ heldOn: '2026-11-30', basisPoints: 1250, netPaise: 280_000n, sharePaise: 35_000n, isProvisional: false });
  });

  it('marks the statements provisional while the month is a preview', () => {
    const [row] = statementsOf([holder('Kabir', 1250)], { ...NOVEMBER, generatedAt: null, isPreview: true }, ISSUER, '2026-11-01');
    expect(row?.statement.isProvisional).toBe(true);
  });

  it('offers none at the practice venue', () => {
    render(<PartnerStatements venueId="v2" isPractice />);
    expect(screen.getByText('The practice venue has no statements.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Month' })).toBeNull();
  });
});
