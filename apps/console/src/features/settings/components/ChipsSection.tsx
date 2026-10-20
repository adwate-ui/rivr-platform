import { zodResolver } from '@hookform/resolvers/zod';
import { chipAddSchema } from '@rivr/contracts/venueConfig';
import { useChipDenominations, useVenueConfigActions, type ChipDenomination, type VenueConfigFailure } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Money, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { venueFailureText } from './settingsCopy.ts';

type ChipValues = z.input<typeof chipAddSchema>;

const EMPTY: ChipValues = { rupees: '', name: '' };

/** A new chip: its value in rupees, a multiple of ₹50, and its name. */
function AddChipForm({ venueId, onOutcome }: { venueId: string; onOutcome: (outcome: VenueConfigFailure | 'added') => void }) {
  const { addChip } = useVenueConfigActions(venueId);
  const [resolver] = useState(() => zodResolver(chipAddSchema));
  const form = useForm<ChipValues, unknown, z.output<typeof chipAddSchema>>({ resolver, defaultValues: EMPTY });
  const submit = form.handleSubmit(async ({ rupees, name }) => {
    const done = await addChip.mutateAsync({ value: fromRupees(BigInt(rupees)), name });
    onOutcome(done.ok ? 'added' : done.error);
    if (done.ok) form.reset(EMPTY);
  });
  const isInvalid = form.formState.errors.rupees !== undefined || form.formState.errors.name !== undefined;
  const fields = { rupees: form.register('rupees'), name: form.register('name') };
  return (
    <Stack gap={3}>
      <Inline gap={4} align="start" wrap>
        <Input {...fields.rupees} label={t('console.settings.chipValue')} inputMode="numeric" />
        <Input {...fields.name} label={t('console.settings.chipName')} />
      </Inline>
      {isInvalid ? <ErrorMessage>{t('console.settings.invalidChip')}</ErrorMessage> : null}
      <Button variant="secondary" isLoading={addChip.isPending} onClick={() => void submit()}>{t('console.settings.addChip')}</Button>
    </Stack>
  );
}

function ChipRow({ venueId, chip, onOutcome }: { venueId: string; chip: ChipDenomination; onOutcome: (outcome: VenueConfigFailure | null) => void }) {
  const { setChipActive } = useVenueConfigActions(venueId);
  const toggle = async (isActive: boolean) => {
    const done = await setChipActive.mutateAsync({ chipId: chip.chipId, isActive });
    onOutcome(done.ok ? null : done.error);
  };
  return (
    <Inline gap={6} align="center">
      <Money paise={chip.value} />
      <Switch label={t('console.settings.chipInUse', { name: chip.name })} isOn={chip.isActive} isDisabled={setChipActive.isPending} onChange={(isOn) => void toggle(isOn)} />
    </Inline>
  );
}

/** The venue's chips, for super admins: each can be taken out of use or back, and a new one added. */
export function ChipsSection({ venueId }: { venueId: string }) {
  const chips = useChipDenominations(venueId);
  const [outcome, setOutcome] = useState<VenueConfigFailure | 'added' | null>(null);
  return (
    <Stack gap={6}>
      <Heading level={2}>{t('console.settings.chips')}</Heading>
      <Text tone="muted">{t('console.settings.chipsHint')}</Text>
      {chips.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {chips.isError && chips.data === undefined ? (
        <Inline gap={3}><ErrorMessage>{t('console.settings.loadFailed')}</ErrorMessage><Button variant="text" onClick={() => void chips.refetch()}>{t('common.retry')}</Button></Inline>
      ) : null}
      <Stack gap={3} divided>
        {(chips.data ?? []).map((chip) => <ChipRow key={chip.chipId} venueId={venueId} chip={chip} onOutcome={setOutcome} />)}
      </Stack>
      <AddChipForm venueId={venueId} onOutcome={setOutcome} />
      {outcome === 'added' ? <Text variant="small">{t('console.settings.chipAdded')}</Text> : null}
      {outcome !== null && outcome !== 'added' ? <ErrorMessage>{venueFailureText(outcome)}</ErrorMessage> : null}
    </Stack>
  );
}
