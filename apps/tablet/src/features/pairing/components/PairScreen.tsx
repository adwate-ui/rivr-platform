import { pairingCodeSchema } from '@rivr/contracts';
import { usePairDevice, type PairFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Input, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/**
 * Pairs the tablet (#41): a floor manager adds it on the console and reads out a six-digit code,
 * which signs the tablet in as itself. The frame then shows the tablet's screens.
 */
export function PairScreen() {
  const pair = usePairDevice();
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<PairFailure | null>(null);
  const pairNow = async () => {
    if (!pairingCodeSchema.safeParse(code).success) {
      setFailure('wrong_code');
      return;
    }
    const paired = await pair.mutateAsync(code);
    setFailure(paired.ok ? null : paired.error);
  };
  return (
    <Screen title={t('tablet.pairing.title')}>
      <Stack gap={6}>
        <Text>{t('tablet.pairing.intro')}</Text>
        <Input variant="code" label={t('tablet.pairing.code')} inputMode="numeric" autoComplete="one-time-code" value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        <Button variant="primary" isLoading={pair.isPending} onClick={() => void pairNow()}>{t('tablet.pairing.pair')}</Button>
        {failure === null ? null : (
          <ErrorMessage>{t(failure === 'wrong_code' ? 'tablet.pairing.wrongCode' : 'tablet.pairing.unavailable')}</ErrorMessage>
        )}
      </Stack>
    </Screen>
  );
}
