import { useTournamentActions, type VenueTournament } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Heading, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

interface EventLinkProps {
  venueId: string;
  tournament: VenueTournament;
  /** The venue's other tournaments, any of which it may feed. */
  others: readonly VenueTournament[];
}

/**
 * Before anyone enters (#519, #524; decisions 0250, 0251): the floor makes a tournament a satellite for another,
 * or a Day 1 flight of a Day 2. The database refuses what cannot be, and says so.
 */
export function EventLink({ venueId, tournament, others }: EventLinkProps) {
  const { link } = useTournamentActions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const options = others.filter((each) => each.id !== tournament.id && each.finishedAt === null).map((each) => ({ value: each.id, label: each.name }));
  const choose = (kind: 'satellite' | 'flight', chosen: string[]) => {
    const targetId = chosen[0];
    if (targetId === undefined) return;
    void link.mutateAsync({ tournamentId: tournament.id, kind, targetId })
      .then((done) => setFailure(done.ok ? null : t(`console.tournaments.failures.${done.error}`)));
  };
  return (
    <Stack gap={3}>
      <Heading level={3} variant="subsection">{t('console.tournaments.link.title')}</Heading>
      <Text variant="small" tone="muted">{t('console.tournaments.link.hint')}</Text>
      <ChoiceChips label={t('console.tournaments.link.satelliteFor')} mode="one" options={options} isDisabled={link.isPending}
        selected={tournament.satelliteTargetId === null ? [] : [tournament.satelliteTargetId]} onChange={(chosen) => choose('satellite', chosen)} />
      <ChoiceChips label={t('console.tournaments.link.flightOf')} mode="one" options={options} isDisabled={link.isPending}
        selected={tournament.dayTwoId === null ? [] : [tournament.dayTwoId]} onChange={(chosen) => choose('flight', chosen)} />
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
