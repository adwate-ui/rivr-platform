import { t } from '@rivr/i18n';
import { DisplayShell, Heading, Money, Stack } from '@rivr/ui';

export interface BadBeatJackpotSlideProps {
  /** The bad-beat jackpot pool in paise. */
  amountPaise: bigint;
}

/** TV slide, 1920 by 1080: the bad-beat jackpot figure large in the display face. */
export function BadBeatJackpotSlide({ amountPaise }: BadBeatJackpotSlideProps) {
  return (
    <DisplayShell>
      <Stack grow justify="center" gap={8}>
        <Heading level={1} variant="display">
          {t('tv.badBeatJackpot.title')}
        </Heading>
        <Money paise={amountPaise} size="jackpot" tone="player" />
      </Stack>
    </DisplayShell>
  );
}
