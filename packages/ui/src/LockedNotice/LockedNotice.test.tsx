import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { LockedNotice } from './LockedNotice.tsx';

describe('LockedNotice', () => {
  it('names the one tier that has the feature', () => {
    renderIn(<LockedNotice tiers={['Black card']} />);
    expect(screen.getByText('Black card only.')).toBeInTheDocument();
  });

  it('joins several tiers into one phrase', () => {
    renderIn(<LockedNotice tiers={['Founders’ Circle', 'Black card']} />);
    expect(screen.getByText('Founders’ Circle and Black card only.')).toBeInTheDocument();
  });

  it('shows the lock icon without announcing it', () => {
    const { container } = renderIn(<LockedNotice tiers={['Black card']} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<LockedNotice tiers={['Black card']} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
