import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { CalendarBlock } from './CalendarBlock.tsx';

const SUNDAY = { name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n };
const TURBO = { name: 'Tuesday Turbo', startsAt: new Date('2026-11-17T14:30:00Z'), buyIn: 300000n, guarantee: null };

describe('CalendarBlock', () => {
  it('shows each tournament with its day and time in IST, its buy-in and any guarantee', () => {
    renderIn(<CalendarBlock heading="Tournaments" tournaments={[SUNDAY, TURBO]} />);
    expect(screen.getByText('RIVR Sunday')).toBeInTheDocument();
    expect(screen.getByText('Sunday 15 Nov 2026, 16:00')).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹10,000 · ₹5,00,000 guaranteed')).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹3,000')).toBeInTheDocument();
  });

  it('says when nothing is on the calendar', () => {
    renderIn(<CalendarBlock heading="Tournaments" tournaments={[]} />);
    expect(screen.getByText('No tournaments on the calendar yet.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<CalendarBlock heading="Tournaments" tournaments={[SUNDAY]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
