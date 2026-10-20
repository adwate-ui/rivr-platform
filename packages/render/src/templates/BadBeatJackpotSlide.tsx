import { t } from '@rivr/i18n';
import { DisplayShell, TvJackpotBoard } from '@rivr/ui';

export interface BadBeatJackpotSlideProps {
  /** The bad-beat jackpot pool in paise. */
  amountPaise: bigint;
  /** Tonight's best high hand as the TV words it ("Four of a kind, Queens"; "Table 2 · 22:18 · ₹2,000"); absent before one. */
  highHand?: { title: string; line: string } | undefined;
}

/** TV slide, 1920 by 1080: the jackpot as the TV shows it (#65), the bad-beat figure large and tonight's high hand beneath. */
export function BadBeatJackpotSlide({ amountPaise, highHand }: BadBeatJackpotSlideProps) {
  return (
    <DisplayShell>
      <TvJackpotBoard label={t('tv.badBeatJackpot.title')} amount={amountPaise} highHandLabel={t('tv.jackpot.highHandTonight')}
        highHand={highHand ?? null} noHighHandText={t('tv.jackpot.noHighHand')} />
    </DisplayShell>
  );
}
