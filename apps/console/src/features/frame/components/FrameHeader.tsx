import type { Permission } from '@rivr/contracts';
import { useFloorSeats, useWaitlistBoard } from '@rivr/db';
import { t } from '@rivr/i18n';
import { HeaderPulse, Time } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { requestsWaiting, type QueueCounts } from './rail.ts';

interface FramePulseProps {
  venueId: string;
  permissions: readonly Permission[];
  counts: QueueCounts;
}

/** Who has the header's counts: staff who run the floor. */
export const runsTheFloor = (permissions: readonly Permission[]) => permissions.includes('members.read') && permissions.includes('waitlist.manage');

/**
 * The night at a glance in the header (console v3): how many are seated, waiting on a list and asking the floor for
 * something, each a link to its screen, for staff who run the floor. Requests carry the gold dot while any wait.
 */
export function FramePulse({ venueId, permissions, counts }: FramePulseProps) {
  const navigate = useNavigate();
  const isFloor = runsTheFloor(permissions);
  const seated = useFloorSeats(venueId, isFloor);
  const waiting = useWaitlistBoard(venueId, isFloor);
  if (!isFloor) return null;
  const items = [
    { id: 'seated', count: seated.data?.length ?? 0, label: t('console.shell.pulse.seated'), href: '/' },
    { id: 'waiting', count: waiting.data?.length ?? 0, label: t('console.shell.pulse.waiting'), href: '/waitlist' },
    { id: 'requests', count: requestsWaiting(counts), label: t('console.shell.pulse.requests'), href: '/requests', needsYou: true },
  ];
  return <HeaderPulse label={t('console.shell.pulse.label')} items={items} onNavigate={(href) => void navigate({ href })} />;
}

// The clock moves on the minute; asking every fifteen seconds keeps it within a quarter of one.
const TICK = 15_000;

/** The header's clock, on the 24-hour IST clock, kept to the minute. */
export function FrameClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), TICK);
    return () => globalThis.clearInterval(timer);
  }, []);
  return <Time at={now} tone="muted" />;
}
