import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PromotionList } from './PromotionList.tsx';
import { NAMES, renderWithApi, resetApi } from './promotionsTestApi.tsx';

afterEach(resetApi);

/** A super admin's Promotions, with the rail's counts answering as given. */
function renderForSuperAdmin(counts: { status?: number; body: unknown }) {
  renderWithApi(<PromotionList venueId="v1" names={NAMES.names} onOpen={() => undefined} tab={undefined} onNavigate={() => undefined} canApprove />,
    { '/rpc/staff_queue_counts': counts });
}

describe('Promotions › the To approve tab’s count (decision 0670)', () => {
  it('shows no number until the count is read, never a 0 that is not so', async () => {
    renderForSuperAdmin({ status: 500, body: { message: 'down' } });
    expect(await screen.findByRole('link', { name: 'To approve' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'To approve 0' })).toBeNull();
  });

  it('shows 0 once the count is read and nothing waits', async () => {
    renderForSuperAdmin({ body: [] });
    expect(await screen.findByRole('link', { name: 'To approve 0' })).toBeDefined();
  });
});
