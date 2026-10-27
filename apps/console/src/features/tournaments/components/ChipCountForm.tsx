import { zodResolver } from '@hookform/resolvers/zod';
import { chipCountsSchema } from '@rivr/contracts/tournaments';
import type { DealOrder, TournamentSeatRow } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ConfirmButton } from './ConfirmButton.tsx';

interface ChipCountFormProps {
  left: readonly TournamentSeatRow[];
  hint: string;
  label: string;
  confirm: string;
  isBusy: boolean;
  onCount: (stacks: DealOrder['stacks']) => void;
}

/** Each player left's chips as counted, then one confirmed step with them: a satellite's finish (#519) or a flight's bag (#524). */
export function ChipCountForm({ left, hint, label, confirm, isBusy, onCount }: ChipCountFormProps) {
  const [resolver] = useState(() => zodResolver(chipCountsSchema));
  const form = useForm<z.input<typeof chipCountsSchema>, unknown, z.output<typeof chipCountsSchema>>({
    resolver, defaultValues: { stacks: left.map((row) => ({ entryId: row.entryId, chips: '' })) },
  });
  return (
    <Stack gap={3}>
      <Text tone="muted">{hint}</Text>
      <Inline gap={4} align="end" wrap>
        {left.map((row, index) => (
          <Input key={row.entryId} {...form.register(`stacks.${index}.chips`)} label={t('console.tournaments.payouts.chipsOf', { name: row.fullName })}
            inputMode="numeric" autoComplete="off" />
        ))}
      </Inline>
      {Object.keys(form.formState.errors).length > 0 ? <ErrorMessage>{t('console.tournaments.payouts.invalidChips')}</ErrorMessage> : null}
      <Inline>
        <ConfirmButton variant="primary" label={label} confirm={confirm} isBusy={isBusy}
          onConfirm={() => void form.handleSubmit((counted) => onCount(counted.stacks))()} />
      </Inline>
    </Stack>
  );
}
