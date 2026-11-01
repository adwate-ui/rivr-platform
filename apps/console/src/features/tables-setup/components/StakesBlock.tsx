import { TABLE_GAMES, useTablesSetupActions, type SetupStake, type TableGame } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Grid, Heading, Inline, Input, Stack, StatusMessage, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

// Paise in one chip: blinds are typed in chips.
const PAISE = 100n;

// A blind in whole 50s of chips, as the table type's check has it.
const isBlind = (text: string) => /^\d{2,7}$/.test(text) && Number(text) % 50 === 0;

const chipsOf = (paise: bigint) => String(paise / PAISE);

/** The stakes, each with Change, beside the form for a new one or the one chosen. */
export function StakesBlock({ venueId, stakes }: { venueId: string; stakes: readonly SetupStake[] }) {
  const [editing, setEditing] = useState<SetupStake | null>(null);
  const [saved, setSaved] = useState<{ round: number; text: string | null }>({ round: 0, text: null });
  const columns: readonly DataTableColumn<SetupStake>[] = [
    { key: 'name', header: t('console.tablesSetup.name'), cell: (stake) => stake.name, sortValue: (stake) => stake.name, priority: 'primary' },
    { key: 'game', header: t('console.tablesSetup.game'), cell: (stake) => t(`console.tablesSetup.gamesShort.${stake.game}`) },
    { key: 'blinds', header: t('console.tablesSetup.blinds'), cell: (stake) => formatStakes(stake.smallBlind, stake.bigBlind), sortValue: (stake) => Number(stake.bigBlind), align: 'end' },
    {
      key: 'change', header: t('console.tablesSetup.change'),
      cell: (stake) => (
        <Button variant="text" aria-label={t('console.tablesSetup.changeStake', { name: stake.name })} onClick={() => setEditing(stake)}>
          {t('console.tablesSetup.change')}
        </Button>
      ),
    },
  ];
  return (
    <Grid columns={2} gap={12} stackBelow="medium">
      <Stack gap={4}>
        <Heading level={2} variant="section">{t('console.tablesSetup.stakes')}</Heading>
        <DataTable label={t('console.tablesSetup.stakesLabel')} columns={columns} rows={stakes} rowKey={(stake) => stake.id}
          emptyText={t('console.tablesSetup.stakesEmpty')} />
        <StatusMessage>{saved.text}</StatusMessage>
      </Stack>
      <StakeForm key={editing?.id ?? `new-${saved.round}`} venueId={venueId} stake={editing} onCancel={() => setEditing(null)}
        onSaved={(text) => { setEditing(null); setSaved((last) => ({ round: last.round + 1, text })); }} />
    </Grid>
  );
}

interface StakeFormProps {
  venueId: string;
  stake: SetupStake | null;
  onSaved: (text: string) => void;
  onCancel: () => void;
}

/** The form's values to start from: the stake's own, or empty hold'em for a new one. */
function startFrom(stake: SetupStake | null): { name: string; game: TableGame; small: string; big: string } {
  if (stake === null) return { name: '', game: 'nlh', small: '', big: '' };
  return { name: stake.name, game: stake.game, small: chipsOf(stake.smallBlind), big: chipsOf(stake.bigBlind) };
}

const isStake = (name: string, blinds: { small: string; big: string }) =>
  name.trim() !== '' && isBlind(blinds.small) && isBlind(blinds.big) && Number(blinds.big) > Number(blinds.small);

/** A stake's name, game (fixed once made) and blinds in chips. */
function StakeForm({ venueId, stake, onSaved, onCancel }: StakeFormProps) {
  const { saveStake } = useTablesSetupActions(venueId);
  const [start] = useState(() => startFrom(stake));
  const [name, setName] = useState(start.name);
  const [game, setGame] = useState<TableGame>(start.game);
  const [blinds, setBlinds] = useState({ small: start.small, big: start.big });
  const [failure, setFailure] = useState<string | null>(null);
  const isNew = stake === null;
  const submit = async () => {
    const done = await saveStake.mutateAsync({
      stakeId: isNew ? null : stake.id, name, game, smallBlind: BigInt(blinds.small) * PAISE, bigBlind: BigInt(blinds.big) * PAISE,
    });
    if (done.ok) onSaved(t('console.tablesSetup.saved', { name: name.trim() }));
    else setFailure(t(`console.tablesSetup.failures.${done.error}`));
  };
  return (
    <Stack gap={4}>
      <Heading level={3}>{isNew ? t('console.tablesSetup.newStake') : t('console.tablesSetup.changeStake', { name: start.name })}</Heading>
      <Input label={t('console.tablesSetup.stakeName')} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      <ChoiceChips label={t('console.tablesSetup.game')} mode="one" selected={[game]} isDisabled={!isNew}
        options={TABLE_GAMES.map((one) => ({ value: one, label: t(`console.tablesSetup.games.${one}`) }))}
        onChange={(picked) => setGame(TABLE_GAMES.find((one) => one === picked[0]) ?? game)} />
      {isNew ? null : <Text variant="small" tone="muted">{t('console.tablesSetup.gameFixed')}</Text>}
      <BlindInputs blinds={blinds} onChange={setBlinds} />
      <Inline gap={3}>
        <Button variant="primary" isDisabled={!isStake(name, blinds)} isLoading={saveStake.isPending} onClick={() => void submit()}>
          {t('console.tablesSetup.saveStake')}
        </Button>
        {isNew ? null : <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>}
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

function BlindInputs({ blinds, onChange }: { blinds: { small: string; big: string }; onChange: (blinds: { small: string; big: string }) => void }) {
  return (
    <Stack gap={2}>
      <Inline gap={4} wrap>
        <Input label={t('console.tablesSetup.smallBlind')} value={blinds.small} inputMode="numeric" maxLength={7}
          onChange={(event) => onChange({ ...blinds, small: event.target.value.trim() })} />
        <Input label={t('console.tablesSetup.bigBlind')} value={blinds.big} inputMode="numeric" maxLength={7}
          onChange={(event) => onChange({ ...blinds, big: event.target.value.trim() })} />
      </Inline>
      <Text variant="small" tone="muted">{t('console.tablesSetup.blindsHint')}</Text>
    </Stack>
  );
}
