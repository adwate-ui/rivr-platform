import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KillSwitchBanner } from '../KillSwitchBanner/KillSwitchBanner.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { StreamOverlay } from './StreamOverlay.tsx';

const CLOCK = {
  name: 'RIVR Sunday', level: 'Level 7', remaining: '11:29', blinds: '400/800', ante: 'Ante 800', next: 'Next 500/1,000 ante 1,000',
  stats: [{ label: 'Players', value: '9' }, { label: 'Average', value: '1,93,333' }],
};

describe('StreamOverlay', () => {
  it('shows the level, the time left, the blinds, the next level and the field in one bar', () => {
    renderIn(<StreamOverlay clock={CLOCK} />);
    expect(screen.getByRole('region', { name: 'RIVR Sunday' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Level 7' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('11:29');
    expect(screen.getByText('400/800')).toBeInTheDocument();
    expect(screen.getByText('Ante 800')).toBeInTheDocument();
    expect(screen.getByText('Next 500/1,000 ante 1,000')).toBeInTheDocument();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Players', 'Average']);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['9', '1,93,333']);
  });

  it('says when the clock is paused', () => {
    renderIn(<StreamOverlay clock={{ ...CLOCK, status: 'Paused' }} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('draws nothing on the stream without a clock, and tells a screen reader why', () => {
    renderIn(<StreamOverlay statusText="No tournament is running." />);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('No tournament is running.');
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });

  it('marks its page, so the page behind it is transparent for OBS', () => {
    const { container } = renderIn(<StreamOverlay clock={CLOCK} />);
    expect(container.querySelector('[data-stream-overlay]')).not.toBeNull();
  });

  it('shows the kill-switch banner above the clock', () => {
    renderIn(<StreamOverlay clock={CLOCK} banner={<KillSwitchBanner audience="member" />} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<StreamOverlay clock={CLOCK} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
