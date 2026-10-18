import { formatMoney, t } from '@rivr/i18n';
import { SocialCard } from '@rivr/ui';
import { when } from './when.ts';

export interface TournamentPosterProps {
  /** The tournament: `RIVR Sunday`. */
  name: string;
  /** When it starts, an ISO timestamp. */
  startsAt: string;
  buyInPaise: bigint;
  /** The guaranteed prize pool, the figure in gold; absent for a tournament without one, such as a freezeout. */
  guaranteePaise?: bigint | undefined;
  /** The club's address, from venue configuration. */
  venue: string;
}

/** A tournament poster: its name, the guarantee when it has one, when it starts and the buy-in. */
export function TournamentPoster({ name, startsAt, buyInPaise, guaranteePaise, venue }: TournamentPosterProps) {
  return (
    <SocialCard
      label={t('social.tournament.label')}
      title={name}
      amountPaise={guaranteePaise}
      amountLabel={guaranteePaise === undefined ? undefined : t('social.tournament.guaranteed')}
      details={[when(startsAt), t('social.tournament.buyIn', { amount: formatMoney(buyInPaise) })]}
      venue={venue}
    />
  );
}
