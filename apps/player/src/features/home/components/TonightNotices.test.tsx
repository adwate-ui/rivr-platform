import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TonightNotices } from './TonightNotices.tsx';

afterEach(cleanup);

// Newest first, as my_notices gives them.
const NOTICES = [
  { noticeId: 'n3', body: 'Open till 4 tonight.' },
  { noticeId: 'n2', body: 'Launch night is Sunday.\nDetails: https://rivrpoker.com/launch' },
  { noticeId: 'n1', body: 'Parking at the back gate.' },
];

describe('Tonight › notices (decision 0424)', () => {
  it('shows the two newest in full, each a card from the club with its links, and nothing to close them', () => {
    render(<TonightNotices notices={NOTICES} />);
    expect(screen.getAllByRole('article', { name: 'From the club' })).toHaveLength(2);
    expect(screen.getByText('Open till 4 tonight.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'rivrpoker.com/launch' }).getAttribute('href')).toBe('https://rivrpoker.com/launch');
    expect(screen.queryByText('Parking at the back gate.')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing when no notice runs', () => {
    const { container } = render(<TonightNotices notices={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
