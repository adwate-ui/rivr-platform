import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClubNotices } from './ClubNotices.tsx';

afterEach(cleanup);

describe('the club\'s notices on Home', () => {
  it('shows each notice in force, and nothing when none is up', () => {
    const { container, rerender } = render(<ClubNotices notices={[
      { noticeId: 'n1', body: 'We\'re launching soon. RIVR opens on Sunday 15 November.' },
      { noticeId: 'n2', body: 'Valet parking from 8 pm.' },
    ]} />);
    expect(screen.getByText('We\'re launching soon. RIVR opens on Sunday 15 November.')).toBeDefined();
    expect(screen.getByText('Valet parking from 8 pm.')).toBeDefined();

    rerender(<ClubNotices notices={[]} />);
    expect(container.textContent).toBe('');
  });
});
