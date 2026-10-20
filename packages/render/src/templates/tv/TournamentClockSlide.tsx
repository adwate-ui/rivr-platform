import { formatCountdown, formatMoney, formatNumber, t } from '@rivr/i18n';
import { DisplayShell, TvTournamentClock } from '@rivr/ui';

/** A level's blinds and ante, in chips; an ante of 0 is none. */
export interface Blinds {
  small: number;
  big: number;
  ante: number;
}

export interface TournamentClockSlideProps {
  /** The tournament: "RIVR Sunday". */
  name: string;
  level: number;
  /** The level's time left, in seconds. */
  remainingSeconds: number;
  isPaused?: boolean | undefined;
  blinds: Blinds;
  /** The next level's; absent on the last level. */
  next?: Blinds | undefined;
  players: number;
  entries: number;
  /** The average stack in chips, as the tournament gives it. */
  averageStack: number;
  poolPaise: bigint;
  /** What each place pays, first place first; empty before the payouts are set. */
  payoutsPaise: readonly bigint[];
}

function blindsText({ small, big }: Blinds): string {
  return `${formatNumber(small)}/${formatNumber(big)}`;
}

function nextText(next: Blinds | undefined): string | undefined {
  if (next === undefined) return undefined;
  return next.ante > 0
    ? t('tv.tournamentClock.nextWithAnte', { blinds: blindsText(next), ante: formatNumber(next.ante) })
    : t('tv.tournamentClock.next', { blinds: blindsText(next) });
}

/** TV slide, 1920 by 1080: the tournament clock, its level and time left, blinds, the next level, the field and the payouts. */
export function TournamentClockSlide(props: TournamentClockSlideProps) {
  const { blinds } = props;
  const stats = [
    { label: t('tv.tournamentClock.players'), value: formatNumber(props.players) },
    { label: t('tv.tournamentClock.entries'), value: formatNumber(props.entries) },
    { label: t('tv.tournamentClock.average'), value: formatNumber(props.averageStack) },
    { label: t('tv.tournamentClock.pool'), value: formatMoney(props.poolPaise) },
  ];
  return (
    <DisplayShell>
      <TvTournamentClock name={props.name} level={t('tv.tournamentClock.level', { level: props.level })}
        remaining={formatCountdown(props.remainingSeconds)} status={props.isPaused === true ? t('tv.tournamentClock.paused') : undefined}
        blinds={blindsText(blinds)} ante={blinds.ante > 0 ? t('tv.tournamentClock.ante', { ante: formatNumber(blinds.ante) }) : undefined}
        next={nextText(props.next)} stats={stats} payoutsLabel={t('tv.tournamentClock.payouts')}
        payouts={props.payoutsPaise.map((amount, index) => ({ place: String(index + 1), amount }))} noPayoutsText={t('tv.tournamentClock.noPayouts')} />
    </DisplayShell>
  );
}
