import { t } from '@rivr/i18n';
import { SocialCard } from '@rivr/ui';
import { when } from './when.ts';

export interface HighHandCardProps {
  /** The hand, as the floor approved it: `Straight flush`. */
  hand: string;
  /** As the player agreed to be shown: first name and initial, `Arjun M.` */
  playerName: string;
  /** Where: `Table 3`. */
  tableName: string;
  /** The high-hand bonus, the figure in gold. */
  bonusPaise: bigint;
  /** When the hand was approved, an ISO timestamp. */
  at: string;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A high-hand card: the hand, the bonus, who, where and when. */
export function HighHandCard({ hand, playerName, tableName, bonusPaise, at, venue }: HighHandCardProps) {
  return (
    <SocialCard
      label={t('social.highHand.label')}
      title={hand}
      amountPaise={bonusPaise}
      details={[playerName, tableName, when(at)]}
      venue={venue}
    />
  );
}
