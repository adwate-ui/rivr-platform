import { useTvPairingActions, useTvPairingPolicy, type TvFailure } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { TV_FAILURE_COPY } from './tvCopy.tsx';

interface PairingWindowProps {
  venueId: string;
  /** The owner (venue.configure) switches window-only pairing. */
  canSwitch: boolean;
}

/**
 * Window-only pairing (#325): the owner's switch; while it is on, Pair a TV, after which a TV gets a code for ten
 * minutes, and until when. Nothing while the policy is unknown.
 */
export function PairingWindow({ venueId, canSwitch }: PairingWindowProps) {
  const policy = useTvPairingPolicy(venueId);
  const { setWindowOnly, openWindow } = useTvPairingActions(venueId);
  const [failure, setFailure] = useState<TvFailure | null>(null);
  const report = (done: { ok: true } | { ok: false; error: TvFailure }) => setFailure(done.ok ? null : done.error);
  if (!policy.data) return null;
  const { isWindowOnly, openUntil } = policy.data;
  return (
    <Stack gap={3}>
      {canSwitch ? (
        <Switch label={t('console.tvs.windowOnly')} isOn={isWindowOnly} isDisabled={setWindowOnly.isPending}
          onChange={(isOn) => void setWindowOnly.mutateAsync(isOn).then(report)} />
      ) : null}
      {isWindowOnly ? (
        <Inline gap={4} align="center" wrap>
          <Button variant="secondary" isLoading={openWindow.isPending} onClick={() => void openWindow.mutateAsync().then(report)}>{t('console.tvs.openWindow')}</Button>
          <Text tone="muted">
            {openUntil === null ? t('console.tvs.windowShut') : t('console.tvs.windowOpenUntil', { time: formatTime(new Date(openUntil)) })}
          </Text>
        </Inline>
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(TV_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
