import type { Wallet } from '@rivr/db';
import { creditAvailable, isPastDue } from '@rivr/domain/markers';
import { formatDayMonth, formatMoney, t } from '@rivr/i18n';
import { Divider, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

const day = (iso: string) => formatDayMonth(new Date(iso));

/**
 * Markers on Balance (#74, design prompt "Balance"): each open marker, when it was issued and falls
 * due, and what it still owes; then the credit limit and what is left of it. A marker past its due date
 * says so, and while one is, no new credit is given (#55). Nothing for a member with no credit line and
 * no open marker.
 */
export function MarkersSection({ wallet }: { wallet: Wallet }) {
  // The moment the screen opened: what is overdue now, not as the screen re-renders.
  const [now] = useState(() => new Date());
  if (wallet.creditLimit === null && wallet.markers.length === 0) return null;
  const outstanding = wallet.markers.map((marker) => marker.outstanding);
  const isOverdue = (dueAt: string) => isPastDue(new Date(dueAt), now);
  const isBlocked = wallet.markers.some((marker) => isOverdue(marker.dueAt));
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.balance.markers')}</Heading>
      <Divider />
      {wallet.markers.length === 0 ? <Text tone="muted">{t('player.balance.noMarkers')}</Text> : null}
      {wallet.markers.map((marker) => (
        <Inline key={marker.markerId} gap={4} justify="between">
          {isOverdue(marker.dueAt) ? (
            <Text variant="small" weight="medium">{t('player.balance.markerOverdue', { issued: day(marker.issuedAt), due: day(marker.dueAt) })}</Text>
          ) : (
            <Text variant="small" tone="muted">{t('player.balance.marker', { issued: day(marker.issuedAt), due: day(marker.dueAt) })}</Text>
          )}
          <Money paise={marker.outstanding} />
        </Inline>
      ))}
      {wallet.creditLimit === null ? null : (
        <Text variant="small" tone="muted">
          {isBlocked ? t('player.balance.limitBlocked', { limit: formatMoney(wallet.creditLimit) }) : t('player.balance.limit', {
            limit: formatMoney(wallet.creditLimit), available: formatMoney(creditAvailable(wallet.creditLimit, outstanding)),
          })}
        </Text>
      )}
    </Stack>
  );
}
