import { useHighHandLive, useHighHandTonight, type HighHandLive } from '@rivr/db';
import { formatHighHand, formatNumber, formatTime, t } from '@rivr/i18n';
import { LoadState, Stack, SummaryStrip } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { FloorSheet } from './FloorSheets.tsx';
import { floorSearchFrom } from './floorSearch.ts';

/**
 * The Live floor's high hand (redesign RD-24): the promotion that runs now, and Log a high hand for those who add Bonus by
 * hand (decision 0621). The promotions record's button comes here by `/?log=high-hand`: once the read has come the panel
 * opens, if it may, and the address stops asking, so the panel closed stays closed.
 */
export function useHighHandFloor(venueId: string, permissions: readonly string[], onSheet: (sheet: FloorSheet) => void) {
  const read = useHighHandLive(venueId);
  const live = read.data ?? null;
  const navigate = useNavigate();
  const { log } = floorSearchFrom(useSearch({ strict: false }));
  const canLog = live !== null && permissions.includes('bonus.give');
  // The panel keeps the high hand it opened with: one that pauses meanwhile is refused in words when Pay is pressed.
  const open = useCallback(() => { if (live !== null) onSheet({ kind: 'highHand', live }); }, [live, onSheet]);
  const isAsked = log === 'high-hand';
  const isRead = !read.isPending;
  const isAnswered = useRef(false);
  useEffect(() => {
    if (!isAsked) isAnswered.current = false;
    if (!isAsked || !isRead || isAnswered.current) return;
    isAnswered.current = true;
    if (canLog) open();
    void navigate({ to: '/', search: ({ log: _asked, ...rest }) => rest, replace: true });
  }, [isAsked, isRead, canLog, open, navigate]);
  // A read that failed before it ever answered: the strip says so, with Retry, rather than leave the floor without a word.
  return { live, onLog: canLog ? open : undefined, isFailed: read.isError && read.data === undefined, onRetry: () => void read.refetch() };
}

function paidWords(hands: number): string {
  if (hands === 0) return t('console.floor.highHand.none');
  return hands === 1 ? t('console.floor.highHand.one') : t('console.floor.highHand.many', { count: formatNumber(hands) });
}

interface HighHandStripProps {
  venueId: string;
  /** The high hand that runs now; none, no strip. */
  live: HighHandLive | null;
  /** Opens the logging panel; none for staff who read the strip and may not log a hit. */
  onLog: (() => void) | undefined;
  /** Whether a high hand runs could not be read; `onRetry` asks again. */
  isFailed: boolean;
  onRetry: () => void;
}

/**
 * The strip: the hands the running high hand paid tonight, their Bonus, the last hit, and Log a high hand, on one line at
 * every width. Its own hits, as its record counts them: one that ended earlier tonight is not added in. While they load
 * it keeps its place and Log a high hand; a read that failed says so, with Retry, as the record panel does.
 */
function HighHandStrip({ venueId, live, onLog, isFailed, onRetry }: HighHandStripProps) {
  const read = useHighHandTonight(venueId, live?.promotionId ?? null, live !== null);
  const failed = t('console.floor.highHand.failed');
  if (isFailed) return <LoadState isError errorText={failed} onRetry={onRetry} />;
  if (live === null) return null;
  const action = onLog === undefined ? undefined : { label: t('console.floor.highHand.log'), onPress: onLog };
  const tonight = read.data;
  if (tonight === undefined) {
    if (read.isError) return <LoadState isError errorText={failed} onRetry={() => void read.refetch()} />;
    return <SummaryStrip label={t('console.floor.highHand.label')} lead={t('common.loading')} facts={[]} action={action} />;
  }
  const last = tonight.hits[0];
  return (
    <SummaryStrip label={t('console.floor.highHand.label')} lead={paidWords(tonight.handsPaid)}
      facts={tonight.handsPaid === 0 ? [] : [t('console.floor.highHand.bonus', { chips: formatNumber(tonight.chipsPaid) })]}
      detail={last === undefined ? undefined : t('console.floor.highHand.last', {
        name: last.memberName, hand: formatHighHand(last.hand, last.rank), time: formatTime(new Date(last.at)),
      })}
      action={action} />
  );
}

/**
 * The floor's tables under the high hand strip, while a high hand runs (redesign RD-24); with none running, the tables
 * alone.
 */
export function UnderHighHand({ children, ...strip }: HighHandStripProps & { children: ReactNode }) {
  return (
    <Stack gap={4}>
      <HighHandStrip {...strip} />
      {children}
    </Stack>
  );
}
