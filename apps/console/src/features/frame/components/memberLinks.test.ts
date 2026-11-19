import { describe, expect, it, vi } from 'vitest';
import { memberLinksFor } from './memberLinks.ts';

describe('memberLinksFor', () => {
  it('leads a name to the member account on Members for staff who open Members', () => {
    const onNavigate = vi.fn();
    const links = memberLinksFor(['members.read', 'members.manage'], onNavigate);
    expect(links.hrefOf('m 1')).toBe('/members?member=m%201');
    expect(links.onNavigate).toBe(onNavigate);
  });

  it('leads nowhere without members.read, so the name is plain text', () => {
    expect(memberLinksFor(['members.manage', 'waitlist.manage'], vi.fn()).hrefOf('m-1')).toBeUndefined();
  });

  it('leads nowhere for a role that reads members but cannot open Members', () => {
    expect(memberLinksFor(['members.read', 'waitlist.manage'], vi.fn()).hrefOf('m-1')).toBeUndefined();
  });
});
