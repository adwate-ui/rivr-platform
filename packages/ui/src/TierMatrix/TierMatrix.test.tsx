import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TierMatrix } from './TierMatrix.tsx';

const TIERS = [{ id: 'member', name: 'Member' }, { id: 'black', name: 'Black card' }];
const ROWS = [
  { key: 'learn.library', name: 'Learn library', description: 'The Learn tab.', cells: { member: 'Locked', black: 'On' } },
  { key: 'league.standings', name: 'League', cells: { member: 'Hidden' } },
];

function matrix(rows = ROWS) {
  return renderIn(<TierMatrix label="Features by tier" featureHeader="Feature" tiers={TIERS} rows={rows} emptyText="No features to gate." />);
}

describe('TierMatrix', () => {
  it('is a table named for what it lists, with a column per tier and a row per feature', () => {
    matrix();
    const table = screen.getByRole('table', { name: 'Features by tier' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Feature', 'Member', 'Black card']);
    expect(within(table).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Learn libraryThe Learn tab.', 'League']);
  });

  it('puts each cell under its tier, and leaves a tier with nothing empty', () => {
    matrix();
    const league = screen.getByRole('rowheader', { name: 'League' }).closest('tr');
    expect([...(league?.querySelectorAll('td') ?? [])].map((cell) => cell.textContent)).toEqual(['Hidden', '']);
  });

  it('says so when there are no features', () => {
    matrix([]);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No features to gate.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = matrix();
    expect(await axeViolations(container)).toEqual([]);
  });
});
