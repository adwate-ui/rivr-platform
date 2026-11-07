import { useFeature } from '@rivr/db';
import { useMyBonusHistory, type BonusLine } from '@rivr/db/bonus';
import { formatChips, t } from '@rivr/i18n';
import { useToast } from '@rivr/ui';
import { useEffect, useRef } from 'react';

/** The toast's words for a line: chips added and why, or used and where. Nothing for chips that expired. */
function toastOf(line: BonusLine): string | null {
  const chips = formatChips(line.amount);
  if (line.kind === 'credited') return t('player.bonus.credited', { chips, reason: line.reason ?? '' });
  if (line.kind === 'expired') return null;
  return line.tableName === null ? t('player.bonus.redeemedNoTable', { chips }) : t('player.bonus.redeemed', { chips, table: line.tableName });
}

/**
 * A toast on any screen when bonus chips are added or used while the app is open (decision 0504), behind rewards.bonus. A
 * grant or a redemption makes the member's history stale over the live channel (packages/db provider.tsx); the newest
 * line is read again, and one newer than the line there when the app opened is told. The push tells a member whose app
 * is closed.
 */
export function BonusToasts() {
  // Not FeatureGate: the frame shows no locked notice for a toast.
  return useFeature('rewards.bonus').state === 'enabled' ? <NewLineToasts /> : null;
}

/**
 * When the app was opened. On the first read a line from before then is history, not news; one from after it is told, such
 * as the sign-up bonus given at the selfie step (outside the frame) just before Home. A reload opens it again.
 */
const OPENED_AT = Date.now();

/** Lines told since the app opened: a screen outside the frame (/kyc, an invoice) remounts it, and tells none again. */
const told = new Set<string>();

function NewLineToasts() {
  const newest = useMyBonusHistory(1);
  const toast = useToast();
  // Undefined until the first read.
  const seen = useRef<string | null | undefined>(undefined);
  const line = newest.data?.[0];
  const lineId = newest.data === undefined ? undefined : line?.id ?? null;
  useEffect(() => {
    if (lineId === undefined) return;
    const isFirstRead = seen.current === undefined;
    const isSeen = lineId === seen.current;
    seen.current = lineId;
    if (line === undefined || isSeen || told.has(line.id) || (isFirstRead && new Date(line.at).getTime() < OPENED_AT)) return;
    const words = toastOf(line);
    if (words === null) return;
    told.add(line.id);
    toast(words);
  }, [lineId, line, toast]);
  return null;
}
