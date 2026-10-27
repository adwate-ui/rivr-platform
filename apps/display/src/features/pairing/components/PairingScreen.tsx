import { useTvPairing, type TvPairing } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Heading, Stack, Text } from '@rivr/ui';

/** The code, large enough to read from across the room, and when it changes; or why there is none yet. */
function PairingCode({ pairing }: { pairing: TvPairing }) {
  if (pairing.status === 'loading') return <Text variant="tvBody" tone="muted">{t('display.pairing.loading')}</Text>;
  if (pairing.status === 'too_many') return <Text variant="tvBody">{t('display.pairing.tooMany')}</Text>;
  if (pairing.status === 'window_closed') return <Text variant="tvBody">{t('display.pairing.windowClosed')}</Text>;
  if (pairing.status === 'unavailable') return <Text variant="tvBody">{t('display.pairing.unavailable')}</Text>;
  return (
    <Stack gap={6}>
      <Text variant="tvBody">{t('display.pairing.intro')}</Text>
      <Heading level={2} variant="poster">{pairing.code.code}</Heading>
      <Text variant="tvBody" tone="muted">{t('display.pairing.changes', { time: formatTime(new Date(pairing.code.expiresAt)) })}</Text>
    </Stack>
  );
}

/**
 * A TV that is not paired (#49) shows a six-digit code for staff to type into the console's TVs
 * screen. It asks every few seconds whether they have, and shows its mode once they have.
 */
export function PairingScreen() {
  const pairing = useTvPairing();
  return (
    <Stack gap={8}>
      <Heading level={1} variant="display">{t('display.pairing.title')}</Heading>
      <PairingCode pairing={pairing} />
    </Stack>
  );
}
