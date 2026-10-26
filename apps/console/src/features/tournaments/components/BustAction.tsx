import type { TournamentSeatRow } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { ConfirmButton } from './ConfirmButton.tsx';

interface BustActionProps {
  row: TournamentSeatRow;
  /** A bounty tournament (#117): the press asks who knocked them out, below the list, instead of confirming here. */
  hasBounty: boolean;
  onAsk: (row: TournamentSeatRow) => void;
  onBust: () => void;
}

/** A bust-out, asked twice; in a bounty tournament the press asks who knocked them out instead. */
export function BustAction({ row, hasBounty, onAsk, onBust }: BustActionProps) {
  const name = t('console.tournaments.bustName', { name: row.fullName });
  if (hasBounty) return <Button variant="text" aria-label={name} onClick={() => onAsk(row)}>{t('console.tournaments.bust')}</Button>;
  return <ConfirmButton label={t('console.tournaments.bust')} name={name} confirm={t('console.tournaments.confirmBust')} onConfirm={onBust} />;
}

interface BountyBustProps {
  row: TournamentSeatRow;
  rows: readonly TournamentSeatRow[];
  onBust: (eliminatorId: string) => void;
  onCancel: () => void;
}

/**
 * A bust in a bounty tournament (#117, decision 0206): the floor names who knocked the player out, from the
 * others at their table, who is paid the bounty. With nobody else there, the tables are balanced first.
 */
export function BountyBust({ row, rows, onBust, onCancel }: BountyBustProps) {
  const [eliminator, setEliminator] = useState<string | null>(null);
  const others = rows.filter((other) => other.status === 'seated' && other.table === row.table && other.entryId !== row.entryId);
  return (
    <Stack gap={3}>
      <Text>{t('console.tournaments.payouts.bustOf', { name: row.fullName })}</Text>
      {others.length === 0 ? <Text tone="muted">{t('console.tournaments.payouts.noOthers')}</Text> : (
        <ChoiceChips label={t('console.tournaments.payouts.knockedOutBy')} mode="one" selected={eliminator === null ? [] : [eliminator]}
          options={others.map((other) => ({ value: other.entryId, label: other.fullName }))} onChange={(chosen) => setEliminator(chosen[0] ?? null)} />
      )}
      <Inline gap={4} align="center">
        <Button variant="danger" isDisabled={eliminator === null} onClick={() => { if (eliminator !== null) onBust(eliminator); }}>{t('console.tournaments.confirmBust')}</Button>
        <Button variant="text" onClick={onCancel}>{t('console.tournaments.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
