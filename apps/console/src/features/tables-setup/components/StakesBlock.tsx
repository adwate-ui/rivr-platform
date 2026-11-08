import { useTablesSetupActions, type SetupStake } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Grid, Heading, Inline, Input, Stack, StatusMessage, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

// Paise in one chip: blinds are typed in chips.
const PAISE = 100n;

// A blind in whole 50s of chips, as the table type's check has it.
const isBlind = (text: string) => /^\d{2,7}$/.test(text) && Number(text) % 50 === 0;

const chipsOf = (paise: bigint) => String(paise / PAISE);

// The form open: a new stake's, above the list, or a stake's own by its id, under its row.
const NEW = 'new';

/** The stakes' columns: name, blinds and straddle, then Change, which opens or closes the stake's form. */
function stakeColumns(open: string | null, onChange: (stake: SetupStake) => void): readonly DataTableColumn<SetupStake>[] {
  return [
    { key: 'name', header: t('console.tablesSetup.name'), cell: (stake) => stake.name, sortValue: (stake) => stake.name, priority: 'primary', filter: 'text' },
    { key: 'blinds', header: t('console.tablesSetup.blinds'), cell: (stake) => formatStakes(stake.smallBlind, stake.bigBlind), sortValue: (stake) => Number(stake.bigBlind), align: 'end' },
    {
      key: 'straddle', header: t('console.tablesSetup.straddle'), align: 'end', filter: 'choice',
      cell: (stake) => (stake.straddle === null ? t('console.tablesSetup.noStraddle') : chipsOf(stake.straddle)),
    },
    {
      key: 'change', header: '', align: 'end',
      cell: (stake) => (
        <Button variant="subtle" size="small" aria-label={t('console.tablesSetup.changeStake', { name: stake.name })} aria-expanded={open === stake.id}
          onClick={() => onChange(stake)}>
          {t('console.tablesSetup.change')}
        </Button>
      ),
    },
  ];
}

/**
 * The stakes (console v3): each with Change, which opens its form under its row, and New stake, which opens an empty one
 * above the list. With no stakes yet the new one is open.
 */
export function StakesBlock({ venueId, stakes }: { venueId: string; stakes: readonly SetupStake[] }) {
  const [open, setOpen] = useState<string | null>(stakes.length === 0 ? NEW : null);
  const [saved, setSaved] = useState<string | null>(null);
  const toggle = (next: string) => { setSaved(null); setOpen(open === next ? null : next); };
  const form = (stake: SetupStake | null) => (
    <StakeForm key={stake?.id ?? NEW} venueId={venueId} stake={stake} onCancel={() => setOpen(null)}
      onSaved={(text) => { setOpen(null); setSaved(text); }} />
  );
  return (
    <Stack gap={4}>
      <Inline justify="between" gap={4}>
        <Heading level={2} variant="section">{t('console.tablesSetup.stakes')}</Heading>
        <Button variant="subtle" size="compact" aria-expanded={open === NEW} onClick={() => toggle(NEW)}>{t('console.tablesSetup.newStake')}</Button>
      </Inline>
      {open === NEW ? form(null) : null}
      <DataTable label={t('console.tablesSetup.stakesLabel')} columns={stakeColumns(open, (stake) => toggle(stake.id))} rows={stakes} narrowLayout="scroll" rowKey={(stake) => stake.id}
        emptyText={t('console.tablesSetup.stakesEmpty')} rowDetail={(stake) => (open === stake.id ? form(stake) : null)} />
      <StatusMessage>{saved}</StatusMessage>
    </Stack>
  );
}

interface StakeFormProps {
  venueId: string;
  stake: SetupStake | null;
  onSaved: (text: string) => void;
  onCancel: () => void;
}

interface Blinds {
  small: string;
  big: string;
  /** Empty for none. */
  straddle: string;
}

/** The form's values to start from: the stake's own, or empty for a new one. */
function startFrom(stake: SetupStake | null): { name: string } & Blinds {
  if (stake === null) return { name: '', small: '', big: '', straddle: '' };
  return { name: stake.name, small: chipsOf(stake.smallBlind), big: chipsOf(stake.bigBlind), straddle: stake.straddle === null ? '' : chipsOf(stake.straddle) };
}

/** A straddle is none, or whole 50s above the big blind (decision 0299). */
const isStraddle = (blinds: Blinds) => blinds.straddle === '' || (isBlind(blinds.straddle) && Number(blinds.straddle) > Number(blinds.big));

const isStake = (name: string, blinds: Blinds) =>
  name.trim() !== '' && isBlind(blinds.small) && isBlind(blinds.big) && Number(blinds.big) > Number(blinds.small) && isStraddle(blinds);

/** A stake's name, blinds and any straddle in chips; no game (decision 0299). */
function StakeForm({ venueId, stake, onSaved, onCancel }: StakeFormProps) {
  const { saveStake } = useTablesSetupActions(venueId);
  const [start] = useState(() => startFrom(stake));
  const [name, setName] = useState(start.name);
  const [blinds, setBlinds] = useState<Blinds>({ small: start.small, big: start.big, straddle: start.straddle });
  const [failure, setFailure] = useState<string | null>(null);
  const isNew = stake === null;
  const submit = async () => {
    const done = await saveStake.mutateAsync({
      stakeId: isNew ? null : stake.id, name, smallBlind: BigInt(blinds.small) * PAISE, bigBlind: BigInt(blinds.big) * PAISE,
      straddle: blinds.straddle === '' ? null : BigInt(blinds.straddle) * PAISE,
    });
    if (done.ok) onSaved(t('console.tablesSetup.saved', { name: name.trim() }));
    else setFailure(t(`console.tablesSetup.failures.${done.error}`));
  };
  return (
    <Stack gap={4}>
      <Heading level={3}>{isNew ? t('console.tablesSetup.newStake') : t('console.tablesSetup.changeStake', { name: start.name })}</Heading>
      <Grid columns={4} gap={4} stackBelow="medium">
        <Input label={t('console.tablesSetup.stakeName')} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        <BlindInputs blinds={blinds} onChange={setBlinds} />
      </Grid>
      <Text variant="small" tone="muted">{t('console.tablesSetup.blindsHint')}</Text>
      <Inline gap={3}>
        <Button variant="subtle" size="compact" isLoading={saveStake.isPending}
          onClick={() => { if (isStake(name, blinds)) void submit(); else setFailure(t('console.tablesSetup.stakeIncomplete')); }}>
          {t('console.tablesSetup.saveStake')}
        </Button>
        <Button variant="text" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}

/** The blinds and any straddle, each a cell of the form's row; their rule is the line under it. */
function BlindInputs({ blinds, onChange }: { blinds: Blinds; onChange: (blinds: Blinds) => void }) {
  return (
    <>
      <Input label={t('console.tablesSetup.smallBlind')} value={blinds.small} inputMode="numeric" maxLength={7}
        onChange={(event) => onChange({ ...blinds, small: event.target.value.trim() })} />
      <Input label={t('console.tablesSetup.bigBlind')} value={blinds.big} inputMode="numeric" maxLength={7}
        onChange={(event) => onChange({ ...blinds, big: event.target.value.trim() })} />
      <Input label={t('console.tablesSetup.straddleOptional')} value={blinds.straddle} inputMode="numeric" maxLength={7}
        onChange={(event) => onChange({ ...blinds, straddle: event.target.value.trim() })} />
    </>
  );
}
