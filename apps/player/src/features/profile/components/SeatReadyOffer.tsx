import { useFeature, usePreferences } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Inline, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { usePhonePush } from '../hooks/usePhonePush.ts';

// Not now is remembered on this phone, as the install offer's is.
const NOT_NOW_KEY = 'rivr-seat-ready-not-now';

function isNotNow(): boolean {
  try {
    return localStorage.getItem(NOT_NOW_KEY) !== null;
  } catch {
    return false;
  }
}

function rememberNotNow() {
  try {
    localStorage.setItem(NOT_NOW_KEY, new Date().toISOString());
  } catch {
    // Private mode: the offer comes back next time.
  }
}

/**
 * For a member with a place on a list (F3-26): when their tier sends seat calls by push (push.seat_ready), they have not
 * turned seat calls off, and this phone could tell them but does not yet, the offer to turn it on, as Profile's switch
 * does. Nothing on a phone without push, blocked, already on, or once Not now is pressed here. One compact row, the line
 * and its two buttons (decision 0300: the owner asked it streamlined).
 */
export function SeatReadyOffer() {
  const phone = usePhonePush();
  const access = useFeature('push.seat_ready');
  const preferences = usePreferences();
  const [isDismissed, setDismissed] = useState(isNotNow);
  const [isAsked, setAsked] = useState(false);
  if (isAsked && phone.state === 'on') return <StatusMessage>{t('player.profile.seatReadyOn')}</StatusMessage>;
  const wantsSeatCalls = preferences.data !== undefined && !preferences.data.notificationsOff.includes('push.seat_ready');
  if (isDismissed || access.state !== 'enabled' || !wantsSeatCalls || phone.state !== 'off') return null;
  const notNow = () => { rememberNotNow(); setDismissed(true); };
  return (
    <Box padding={3} radius="md" hairline="all">
      <Stack gap={2}>
        <Inline gap={2} justify="between" align="center" wrap>
          <Text variant="small">{t('player.profile.seatReadyOffer')}</Text>
          <Inline gap={1}>
            <Button variant="text" onClick={notNow}>{t('player.profile.seatReadyNotNow')}</Button>
            <Button variant="secondary" isLoading={phone.isBusy} aria-label={t('player.profile.seatReadyYesName')}
              onClick={() => { setAsked(true); void phone.change(true); }}>
              {t('player.profile.seatReadyYes')}
            </Button>
          </Inline>
        </Inline>
        {phone.failed ? <ErrorMessage>{t('player.profile.saveFailed')}</ErrorMessage> : null}
      </Stack>
    </Box>
  );
}
