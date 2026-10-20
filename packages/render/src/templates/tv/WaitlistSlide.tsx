import { t } from '@rivr/i18n';
import { DisplayShell, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';

export interface WaitlistSlideProps {
  /** Each stake as the TV's waitlist board shows it (#65): its name, the tables open, and its places in order. */
  stakes: readonly TvWaitlistStake[];
}

/** TV slide, 1920 by 1080: the waitlist board, each stake with its places, a player as a first name and initial. */
export function WaitlistSlide({ stakes }: WaitlistSlideProps) {
  return (
    <DisplayShell>
      <TvWaitlistBoard title={t('tv.waitlist.title')} stakes={stakes} emptyText={t('tv.waitlist.empty')} />
    </DisplayShell>
  );
}
