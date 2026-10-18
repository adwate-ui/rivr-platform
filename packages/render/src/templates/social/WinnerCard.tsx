import { t } from '@rivr/i18n';
import { SocialCard, type SocialFormat } from '@rivr/ui';
import { when } from './when.ts';

export interface WinnerCardProps {
  format: SocialFormat;
  /** As the player agreed to be shown: first name and initial, `Arjun M.` */
  playerName: string;
  /** What they won: `RIVR Sunday`, `Bad-beat jackpot`. */
  eventName: string;
  /** The prize, the figure in gold. */
  prizePaise: bigint;
  /** When they won, an ISO timestamp. */
  wonAt: string;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A winner card, published only once the player consents (lane D): who won, the prize, what and when. */
export function WinnerCard({ format, playerName, eventName, prizePaise, wonAt, venue }: WinnerCardProps) {
  return (
    <SocialCard
      format={format}
      label={t('social.winner.label')}
      title={playerName}
      amountPaise={prizePaise}
      details={[eventName, when(wonAt)]}
      venue={venue}
    />
  );
}
