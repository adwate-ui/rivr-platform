import { t } from '@rivr/i18n';
import { SocialCard } from '@rivr/ui';
import { when } from './when.ts';

export interface WinnerCardProps {
  /** As the player agreed to be shown: first name and initial, `Arjun M.` */
  playerName: string;
  /** What they won: `RIVR Sunday`, `Bad-beat jackpot`. */
  eventName: string;
  /**
   * The prize as announced: gross, before TDS. A card never shows a player's tax or net payout
   * (safest reading; question #242).
   */
  prizePaise: bigint;
  /** When they won, an ISO timestamp. */
  wonAt: string;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A winner card, published only once the player consents (lane D): who won, the prize, what and when. */
export function WinnerCard({ playerName, eventName, prizePaise, wonAt, venue }: WinnerCardProps) {
  return (
    <SocialCard label={t('social.winner.label')} title={playerName} amountPaise={prizePaise} details={[eventName, when(wonAt)]} venue={venue} />
  );
}
