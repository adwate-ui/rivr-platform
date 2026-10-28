import { useJackpot, useStaffVenue, type Jackpot } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Heading, Money, Screen, Stack, Text } from '@rivr/ui';
import { BadBeatForm } from './BadBeatForm.tsx';
import { eventText, previewText, ruleText } from './jackpotCopy.ts';
import { ReverseForm } from './ReverseForm.tsx';

/** One pool under its name. */
function Pool({ label, paise, isMain = false }: { label: string; paise: bigint; isMain?: boolean }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{label}</Text>
      <Money paise={paise} size={isMain ? 'title' : 'lead'} tone={isMain ? 'player' : 'default'} />
    </Stack>
  );
}

/** The payouts and reversals, latest first; a payout not yet reversed can be, by staff who pay jackpots. */
function History({ venueId, jackpot, canPay }: { venueId: string; jackpot: Jackpot; canPay: boolean }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.jackpots.history')}</Heading>
      {jackpot.events.length === 0 ? <Text tone="muted">{t('console.jackpots.noHistory')}</Text> : (
        <Stack gap={4} divided>
          {jackpot.events.map((event) => (
            <Stack key={event.eventId} gap={2}>
              <Text>{eventText(event)}</Text>
              {event.kind === 'payout' ? <Text variant="small" tone="muted">{previewText(event, event.others)}</Text> : null}
              {event.isReversed ? <Text variant="small" tone="muted">{t('console.jackpots.wasReversed')}</Text> : null}
              {canPay && event.kind === 'payout' && !event.isReversed ? <ReverseForm venueId={venueId} payout={event} /> : null}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function JackpotBody({ venueId, canPay }: { venueId: string; canPay: boolean }) {
  const jackpot = useJackpot(venueId);
  const title = t('console.jackpots.title');
  if (jackpot.isPending) return <Screen title={title} status="loading" />;
  if (jackpot.data === undefined) return <Screen title={title} status="error" onRetry={() => void jackpot.refetch()} />;
  const { rule } = jackpot.data;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <Stack gap={3}>
          <Grid columns={3} gap={6} stackBelow="medium">
            <Pool label={t('console.jackpots.main')} paise={jackpot.data.main} isMain />
            <Pool label={t('console.jackpots.season')} paise={jackpot.data.season} />
            <Pool label={t('console.jackpots.freeroll')} paise={jackpot.data.freeroll} />
          </Grid>
          <Text variant="small" tone="muted">{rule === null ? t('console.jackpots.noRule') : ruleText(rule)}</Text>
        </Stack>
        {canPay && rule !== null ? <BadBeatForm venueId={venueId} pool={jackpot.data.main} rule={rule} /> : null}
        <History venueId={venueId} jackpot={jackpot.data} canPay={canPay} />
      </Stack>
    </Screen>
  );
}

/**
 * Jackpots (#48, scope-v1 module 8): the bad-beat jackpot and its season and freeroll pools, the
 * payout rule, paying a bad beat in chips, and the payouts with their reversals. Staff who pay
 * jackpots pay and reverse; staff who read the ledger see it all.
 */
export function JackpotsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  const canPay = permissions.includes('jackpots.approve');
  if (!canPay && !permissions.includes('ledger.read')) {
    return <Screen title={t('console.jackpots.title')} status="error" errorText={t('console.jackpots.notAllowed')} />;
  }
  return <JackpotBody venueId={venueId} canPay={canPay} />;
}
