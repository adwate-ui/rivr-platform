import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { FeatureGate } from './FeatureGate.tsx';

const drill = <button type="button">Start drill</button>;

describe('FeatureGate', () => {
  it('renders the feature when the tier has it', () => {
    renderIn(<FeatureGate access={{ state: 'enabled' }}>{drill}</FeatureGate>);
    expect(screen.getByRole('button', { name: 'Start drill' })).toBeInTheDocument();
  });

  it('renders the locked notice, naming the tiers, in place of a locked feature', () => {
    renderIn(<FeatureGate access={{ state: 'locked', tiers: ['Academy graduate', 'Black card'] }}>{drill}</FeatureGate>);
    expect(screen.queryByRole('button', { name: 'Start drill' })).not.toBeInTheDocument();
    expect(screen.getByText('Academy graduate and Black card only.')).toBeInTheDocument();
  });

  it('renders nothing for a hidden feature', () => {
    const { container } = renderIn(<FeatureGate access={{ state: 'hidden' }}>{drill}</FeatureGate>);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations when locked', async () => {
    const { container } = renderIn(<FeatureGate access={{ state: 'locked', tiers: ['Black card'] }}>{drill}</FeatureGate>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
