import { zodResolver } from '@hookform/resolvers/zod';
import { dealerTabletAddSchema } from '@rivr/contracts';
import { useDeviceActions, type DeviceFailure, type PairingCode } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { DEVICE_FAILURE_COPY } from './failureCopy.ts';

interface AddTabletFormProps {
  venueId: string;
  /** The new tablet's pairing code, to show on its row. */
  onCode: (code: PairingCode) => void;
}

/**
 * Adds a dealer tablet by name and starts pairing it: the code shows on its row. Added but not
 * paired (a dropped connection, say), the form says so: New pairing code on its row pairs it.
 */
export function AddTabletForm({ venueId, onCode }: AddTabletFormProps) {
  const { add } = useDeviceActions(venueId);
  const [failure, setFailure] = useState<DeviceFailure | null>(null);
  const [isAddedWithoutCode, setIsAddedWithoutCode] = useState(false);
  const [resolver] = useState(() => zodResolver(dealerTabletAddSchema));
  const form = useForm<z.input<typeof dealerTabletAddSchema>, unknown, z.output<typeof dealerTabletAddSchema>>({
    resolver, defaultValues: { name: '' },
  });
  const submit = form.handleSubmit(async ({ name }) => {
    const added = await add.mutateAsync({ name });
    setFailure(added.ok ? null : added.error);
    setIsAddedWithoutCode(added.ok && added.value === null);
    if (!added.ok) return;
    form.reset();
    if (added.value !== null) onCode(added.value);
  });
  const nameField = form.register('name');
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input {...nameField} label={t('console.tablets.name')} hint={t('console.tablets.nameHint')} autoComplete="off"
          error={form.formState.errors.name ? t('console.tablets.invalidName') : undefined} />
        <Button variant="secondary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.tablets.add')}</Button>
      </Inline>
      {isAddedWithoutCode ? <Text variant="small">{t('console.tablets.addedWithoutCode')}</Text> : null}
      {failure === null ? null : <ErrorMessage>{t(DEVICE_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
