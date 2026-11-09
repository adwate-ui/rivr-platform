import { describe, expect, it } from 'vitest';

// Consistent states (#607, F-164): every feature's source, as text.
const SOURCES = import.meta.glob<string>(['./features/**/*.tsx', '!./features/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true });

// Their own on purpose: two screens hidden since decision 0284, Home's one-line tickets failure, and an identity step whose Retry is its only action.
const OWN_STATES: readonly string[] = [
  './features/balance/components/DepositScreen.tsx',
  './features/balance/components/PayoutAccountsSection.tsx',
  './features/home/components/TournamentTickets.tsx',
  './features/kyc/components/KycRecordStates.tsx',
  './features/kyc/components/KycReturnScreen.tsx',
];

describe('the player app\'s states', () => {
  it('shows a load and a failed load with its Retry only through LoadState or Screen, never a block of its own', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    const own = Object.entries(SOURCES).filter(([, source]) => source.includes("'common.retry'") || source.includes("'common.loading'")).map(([file]) => file).sort();
    expect(own).toEqual(OWN_STATES);
  });
});
