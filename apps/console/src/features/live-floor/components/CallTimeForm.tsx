import { useSetSeatCallTime, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';

interface CallTimeFormProps {
  venueId: string;
  player: SeatedPlayer;
  onDone: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
  onCancel: () => void;
}

const isMinutes = (text: string) => /^\d{1,4}$/.test(text) && Number(text) <= 1440;

/** The floor changes a seated player's call time (#638), in whole minutes from when they sat down; 0 for none. */
export function CallTimeForm({ venueId, player, onDone, onCancel }: CallTimeFormProps) {
  const setCallTime = useSetSeatCallTime(venueId);
  const [minutes, setMinutes] = useState('');
  const submit = async () => onDone(await setCallTime.mutateAsync({ sessionId: player.sessionId, minutes: Number(minutes) }));
  return (
    <Stack gap={3}>
      <Heading level={3} isFocusedOnMount>{t('console.liveFloor.changeCallTimeName', { name: player.fullName })}</Heading>
      <Input label={t('console.liveFloor.callTimeMinutes')} hint={t('console.liveFloor.callTimeHint')} value={minutes} inputMode="numeric"
        maxLength={4} autoComplete="off" error={minutes === '' || isMinutes(minutes) ? undefined : t('console.liveFloor.callTimeInvalid')}
        onChange={(event) => setMinutes(event.target.value.trim())} />
      <Inline gap={3}>
        <Button variant="secondary" isDisabled={!isMinutes(minutes)} isLoading={setCallTime.isPending} onClick={() => void submit()}>
          {t('console.liveFloor.saveCallTime')}
        </Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
