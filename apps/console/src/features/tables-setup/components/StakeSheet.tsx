import { useTablesSetupActions, type SetupStake, type StakeOrder } from '@rivr/db';
import { chipsToPaise, fromPaise, paiseToChips } from '@rivr/domain/money';
import { isStakeCallTime } from '@rivr/domain/tables';
import { t } from '@rivr/i18n';
import { ErrorMessage, Grid, Input, Sheet, Stack, Text, UnitInput, useToast } from '@rivr/ui';
import { useState } from 'react';
import { SaveFooter } from './SaveFooter.tsx';
import { useSave } from './useSave.ts';

// A blind in whole 50s, as the table type's check has it.
const isBlind = (text: string) => /^\d{2,7}$/.test(text) && Number(text) % 50 === 0;

// Blinds are typed as plain figures: 100 for a blind of 100.
const typedOf = (paise: bigint) => String(paiseToChips(fromPaise(paise)));

/** The stake as typed: its name, its blinds and any straddle (empty for none), and its call time in minutes. */
interface StakeDraft {
  name: string;
  small: string;
  big: string;
  straddle: string;
  callTime: number | null;
}

/** The form's values to start from: the stake's own, or empty for a new one. A stake with no call time starts with none. */
function startFrom(stake: SetupStake | null): StakeDraft {
  if (stake === null) return { name: '', small: '', big: '', straddle: '', callTime: null };
  return {
    name: stake.name, small: typedOf(stake.smallBlind), big: typedOf(stake.bigBlind), straddle: stake.straddle === null ? '' : typedOf(stake.straddle),
    callTime: stake.callTimeMinutes > 0 ? stake.callTimeMinutes : null,
  };
}

/** A straddle is none, or whole 50s above the big blind (decision 0299). */
const isStraddle = (draft: StakeDraft) => draft.straddle === '' || (isBlind(draft.straddle) && Number(draft.straddle) > Number(draft.big));

const hasBlinds = (draft: StakeDraft) => isBlind(draft.small) && isBlind(draft.big) && Number(draft.big) > Number(draft.small);

/**
 * The stake as it would be saved, or null while it does not stand: a name, blinds in whole 50s with the big above the
 * small, any straddle above both, and a call time. Staff who may not set the call time send none: the stake keeps its own.
 */
function orderFrom(draft: StakeDraft, stakeId: string | null, canSetCallTime: boolean): StakeOrder | null {
  const hasCallTime = !canSetCallTime || (draft.callTime !== null && isStakeCallTime(draft.callTime));
  if (draft.name.trim() === '' || !hasBlinds(draft) || !isStraddle(draft) || !hasCallTime) return null;
  return {
    stakeId, name: draft.name, smallBlind: chipsToPaise(BigInt(draft.small)), bigBlind: chipsToPaise(BigInt(draft.big)),
    straddle: draft.straddle === '' ? null : chipsToPaise(BigInt(draft.straddle)), callTimeMinutes: canSetCallTime ? draft.callTime : null,
  };
}

interface StakeFieldsProps {
  draft: StakeDraft;
  canSetCallTime: boolean;
  onChange: (change: Partial<StakeDraft>) => void;
}

/** The stake's fields: its name, its blinds over their rule, any straddle, and its call time in minutes, or why it is not theirs to set. */
function StakeFields({ draft, canSetCallTime, onChange }: StakeFieldsProps) {
  return (
    <>
      <Input label={t('console.tablesSetup.stakeName')} value={draft.name} maxLength={60} onChange={(event) => onChange({ name: event.target.value })} />
      <Stack gap={2}>
        <Grid columns={2} gap={4}>
          <Input label={t('console.tablesSetup.smallBlind')} value={draft.small} inputMode="numeric" maxLength={7} onChange={(event) => onChange({ small: event.target.value.trim() })} />
          <Input label={t('console.tablesSetup.bigBlind')} value={draft.big} inputMode="numeric" maxLength={7} onChange={(event) => onChange({ big: event.target.value.trim() })} />
        </Grid>
        <Text variant="small" tone="muted">{t('console.tablesSetup.blindsRule')}</Text>
      </Stack>
      <Input label={t('console.tablesSetup.straddleOptional')} value={draft.straddle} inputMode="numeric" maxLength={7}
        onChange={(event) => onChange({ straddle: event.target.value.trim() })} />
      {canSetCallTime
        ? <UnitInput label={t('console.tablesSetup.callTime')} unit="minutes" min={1} max={1440} initialValue={draft.callTime} onChange={(callTime) => onChange({ callTime })} />
        : <Text tone="muted">{t('console.tablesSetup.callTimeNotYours')}</Text>}
    </>
  );
}

interface StakeSheetProps {
  venueId: string;
  /** The stake to change, or null for a new one. */
  stake: SetupStake | null;
  /** Whether the staff member changes settings (settings.manage): a stake's call time is one, and the database refuses the rest. */
  canSetCallTime: boolean;
  onClose: () => void;
}

/**
 * A stake made or changed in the panel at the side (redesign RD-17): its name, blinds, any straddle and its call time, the
 * same value Settings shows. No game (decision 0299). Saved, it says so in a toast and closes; refused, it says why until a
 * field is edited. The caller keys it by each opening, so it opens on the stake's own values.
 */
export function StakeSheet({ venueId, stake, canSetCallTime, onClose }: StakeSheetProps) {
  const { saveStake } = useTablesSetupActions(venueId);
  const toast = useToast();
  const [draft, setDraft] = useState(() => startFrom(stake));
  const { failure, save, clearFailure } = useSave(async () => {
    const order = orderFrom(draft, stake?.id ?? null, canSetCallTime);
    if (order === null) return t('console.tablesSetup.stakeIncomplete');
    const done = await saveStake.mutateAsync(order);
    if (!done.ok) return t(`console.tablesSetup.failures.${done.error}`);
    toast(t(stake === null ? 'console.tablesSetup.stakeAdded' : 'console.tablesSetup.saved', { name: draft.name.trim() }));
    onClose();
    return null;
  });
  const set = (change: Partial<StakeDraft>) => {
    clearFailure();
    setDraft({ ...draft, ...change });
  };
  return (
    <Sheet place="console" isOpen onClose={onClose} footer={<SaveFooter isSaving={saveStake.isPending} onCancel={onClose} onSave={() => void save()} />}
      title={stake === null ? t('console.tablesSetup.newStake') : t('console.tablesSetup.changeStake', { name: stake.name })}>
      <Stack gap={5}>
        <StakeFields draft={draft} canSetCallTime={canSetCallTime} onChange={set} />
        {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
