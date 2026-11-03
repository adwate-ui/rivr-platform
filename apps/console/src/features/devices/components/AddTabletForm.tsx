import { zodResolver } from '@hookform/resolvers/zod';
import { dealerTabletAddSchema } from '@rivr/contracts';
import { useDeviceActions, type DeviceFailure, type PairingCode } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage, Switch, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { DEVICE_FAILURE_COPY } from './failureCopy.ts';

interface AddTabletFormProps {
  venueId: string;
  /** The new tablet's pairing code, to show on its row. */
  onCode: (code: PairingCode) => void;
}

/**
 * Adds a dealer tablet, or a door kiosk (decision 0164), by name and starts pairing it: the code shows
 * on its row. Added but not paired (a dropped connection, say), the form says so: New pairing code on
 * its row pairs it.
 */
export function AddTabletForm({ venueId, onCode }: AddTabletFormProps) {
  const { add } = useDeviceActions(venueId);
  const [failure, setFailure] = useState<DeviceFailure | null>(null);
  const [isAddedWithoutCode, setIsAddedWithoutCode] = useState(false);
  const [isDoor, setIsDoor] = useState(false);
  const [resolver] = useState(() => zodResolver(dealerTabletAddSchema));
  const form = useForm<z.input<typeof dealerTabletAddSchema>, unknown, z.output<typeof dealerTabletAddSchema>>({
    resolver, defaultValues: { name: '' },
  });
  const submit = form.handleSubmit(async ({ name }) => {
    const added = await add.mutateAsync({ name, isDoor });
    setFailure(added.ok ? null : added.error);
    setIsAddedWithoutCode(added.ok && added.value === null);
    if (!added.ok) return;
    form.reset();
    if (added.value !== null) onCode(added.value);
  });
  const nameField = form.register('name');
  // The hint, or what is wrong, sits under the row and is read with the field.
  const noteId = useId();
  const isWrong = form.formState.errors.name !== undefined;
  return (
    <Stack gap={2}>
      <Heading level={3}>{t('console.tablets.addTitle')}</Heading>
      {/* The name and Add the same 44 px, ends on one line, so Add sits centred on the field; the hint under them both. */}
      <Inline gap={3} align="end" wrap>
        <Input {...nameField} label={t('console.tablets.name')} autoComplete="off" aria-describedby={noteId} aria-invalid={isWrong || undefined} />
        <Button variant="primary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.tablets.add')}</Button>
      </Inline>
      {isWrong ? <ErrorMessage id={noteId}>{t('console.tablets.invalidName')}</ErrorMessage>
        : <Text id={noteId} variant="small" tone="muted">{t('console.tablets.nameHint')}</Text>}
      <Switch label={t('console.tablets.isDoor')} hint={t('console.tablets.isDoorHint')} isOn={isDoor} onChange={setIsDoor} />
      <StatusMessage>{isAddedWithoutCode ? t('console.tablets.addedWithoutCode') : null}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(DEVICE_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
