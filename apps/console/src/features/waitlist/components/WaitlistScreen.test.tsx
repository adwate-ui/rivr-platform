import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WaitlistScreen } from './WaitlistScreen.tsx';

const staff = vi.hoisted((): { permissions: string[] } => ({ permissions: [] }));

vi.mock('@rivr/db', () => ({ useStaffVenue: () => ({ status: 'ready', venue: { venueId: 'v1', permissions: staff.permissions } }) }));
vi.mock('./WaitlistLists.tsx', () => ({ WaitlistLists: ({ canCheckId }: { canCheckId: boolean }) => (canCheckId ? 'Check ID offered' : 'No Check ID') }));

afterEach(cleanup);

describe('Waitlist: Check ID goes by role (audit F-014)', () => {
  it.each([
    ['a host, who checks members in person', ['waitlist.manage', 'kyc.in_person'], 'Check ID offered'],
    ['a reviewer', ['waitlist.manage', 'kyc.review'], 'Check ID offered'],
    ['a cashier, whom KYC review refuses', ['waitlist.manage'], 'No Check ID'],
  ])('for %s', (_who, permissions, said) => {
    staff.permissions = permissions;
    render(<WaitlistScreen />);
    expect(screen.getByText(said)).toBeDefined();
  });
});
