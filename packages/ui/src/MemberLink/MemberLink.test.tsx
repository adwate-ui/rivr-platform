import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RequestItem } from '../RequestItem/RequestItem.tsx';
import { SeatRow } from '../SeatRow/SeatRow.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { MemberLink, MemberLinksProvider } from './MemberLink.tsx';

const hrefOf = (memberId: string) => `/members?member=${memberId}`;

describe('MemberLink', () => {
  it('links the name to the member account through the router', async () => {
    const onNavigate = vi.fn();
    renderIn(<MemberLinksProvider links={{ hrefOf, onNavigate }}><MemberLink memberId="m-1">Vidya Chadha</MemberLink></MemberLinksProvider>);
    const link = screen.getByRole('link', { name: 'Vidya Chadha' });
    expect(link).toHaveAttribute('href', '/members?member=m-1');
    await userEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m-1');
  });

  it('is plain text outside a provider, or for a member the viewer may not open', () => {
    const { rerender } = renderIn(<MemberLink memberId="m-1">Vidya Chadha</MemberLink>);
    expect(screen.getByText('Vidya Chadha')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    rerender(<MemberLinksProvider links={{ hrefOf: () => undefined }}><MemberLink memberId="m-1">Vidya Chadha</MemberLink></MemberLinksProvider>);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('in a seat row, the name opens the account and the rest of the row the seat', async () => {
    const onNavigate = vi.fn();
    const onSelect = vi.fn();
    renderIn(<MemberLinksProvider links={{ hrefOf, onNavigate }}><SeatRow number={2} name="Vidya Chadha" memberId="m-2" onSelect={onSelect} /></MemberLinksProvider>);
    await userEvent.click(screen.getByRole('link', { name: 'Vidya Chadha' }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m-2');
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Seat 2, Vidya Chadha' }));
    expect(onSelect).toHaveBeenCalledOnce();
    // Never one inside the other.
    expect(screen.getByRole('button').contains(screen.getByRole('link'))).toBe(false);
  });

  it('is reached by Tab after the row button and opens on Enter', async () => {
    const onNavigate = vi.fn();
    renderIn(<MemberLinksProvider links={{ hrefOf, onNavigate }}><SeatRow number={2} name="Vidya Chadha" memberId="m-2" onSelect={vi.fn()} /></MemberLinksProvider>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Seat 2, Vidya Chadha' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Vidya Chadha' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m-2');
  });

  it('in a request, the name opens the account and the item button still opens who asks', async () => {
    const onNavigate = vi.fn();
    const onTitle = vi.fn();
    renderIn(
      <MemberLinksProvider links={{ hrefOf, onNavigate }}>
        <RequestItem kind="Top-up" title="Ritika Bhalla" memberId="m-3" onTitle={onTitle} primary={{ label: 'Start', onClick: vi.fn() }} />
      </MemberLinksProvider>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Ritika Bhalla' }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m-3');
    expect(onTitle).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ritika Bhalla' }));
    expect(onTitle).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations, alone or in a seat row', async () => {
    const { container } = renderIn(
      <MemberLinksProvider links={{ hrefOf }}>
        <MemberLink memberId="m-1">Vidya Chadha</MemberLink>
        <SeatRow number={2} name="Vidya Chadha" memberId="m-2" request="Top-up" onSelect={vi.fn()} />
      </MemberLinksProvider>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
