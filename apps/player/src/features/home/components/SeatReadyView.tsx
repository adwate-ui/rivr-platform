import { useFeature, useSeatCallActions, useWaitlistActions, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { secondsUntil } from '@rivr/domain/callTime';
import { holdFraction } from '@rivr/domain/waitlist';
import { formatMinutesSeconds, formatTime, t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, FeatureGate, Figure, Heading, ProgressBar, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** The hold counting down each second to the time the server gave, and the bar draining over the hold. */
function HoldClock({ place, now }: { place: WaitlistPlace & { holdUntil: string }; now: Date }) {
  const until = new Date(place.holdUntil);
  const left = secondsUntil(until, now);
  const fraction = place.calledAt === null ? 0 : holdFraction(new Date(place.calledAt), until, now);
  return (
    <Stack gap={1} align="center">
      <Figure size="hold" role="timer" aria-label={t('player.live.ready.timer', { minutes: Math.ceil(left / 60) })}>{formatMinutesSeconds(left)}</Figure>
      <Text variant="small" tone="muted">{t('player.live.ready.heldUntil', { time: formatTime(until) })}</Text>
      <Box paddingY={2}><ProgressBar width="hold" fraction={fraction} /></Box>
    </Stack>
  );
}

/** I'm on my way, once (busy while it tells the floor), and Decline seat, which gives the seat up and leaves the list. */
function Answers({ place }: { place: WaitlistPlace }) {
  const { acceptCall } = useSeatCallActions();
  const { leave } = useWaitlistActions();
  const join = useFeature('waitlist.join');
  const toast = useToast();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const decline = async () => {
    const left = await leave.mutateAsync(place.entryId);
    setFailure(left.ok ? null : left.error);
    if (left.ok) toast(t('player.live.ready.declinedToast'));
  };
  const accept = async () => {
    const accepted = await acceptCall.mutateAsync(place.entryId);
    setFailure(accepted.ok ? null : accepted.error);
  };
  return (
    <Stack gap={2}>
      <FeatureGate access={join}>
        <Button variant="primary" size="tall" fullWidth isLoading={acceptCall.isPending} isDisabled={place.onWayAt !== null} onClick={() => void accept()}>
          {t(acceptCall.isPending ? 'player.live.ready.telling' : 'player.live.ready.onMyWay')}
        </Button>
      </FeatureGate>
      <Button variant="text" size="large" fullWidth isLoading={leave.isPending} onClick={() => void decline()}>{t('player.live.ready.decline')}</Button>
      {failure === null ? null : <ErrorMessage look="dot">{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}

/**
 * The seat is ready (brief 3.4 D): where, the game, the hold counting down from the server's end of it with the bar draining
 * over its 20 minutes, then I'm on my way and Decline seat (the seat call's answers, decision 0321).
 */
export function SeatReadyView({ place, now }: { place: WaitlistPlace & { holdUntil: string }; now: Date }) {
  return (
    <Stack gap={8}>
      <Box paddingX={6} paddingY={8}>
        <Stack gap={3} align="center">
          <Text variant="eyebrow" tone="accent" align="center">{t('player.live.ready.eyebrow')}</Text>
          <Heading level={2} variant="serif" serifSize={48} align="center">
            {t('player.live.ready.title', { table: place.callTableName ?? '', seat: place.callSeat ?? 0 })}
          </Heading>
          <Text tone="muted" align="center">{place.tableTypeName}</Text>
          <Box paddingY={4}><HoldClock place={place} now={now} /></Box>
        </Stack>
      </Box>
      <Box paddingX={5}><Answers place={place} /></Box>
    </Stack>
  );
}
