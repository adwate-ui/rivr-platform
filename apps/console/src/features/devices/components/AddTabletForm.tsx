import { zodResolver } from '@hookform/resolvers/zod';
import { dealerTabletAddSchema } from '@rivr/contracts';
import { useDeviceActions, type DeviceFailure, type PairingCode } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
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
 * Adds a dealer tablet by name and starts pairing it, in the panel at the side (redesign RD-38): the code shows on its
 * row. Added but not paired (a dropped connection, say), a toast says so: New pairing code on its row pairs it.
 */
function AddTabletSheet({ venueId, onCode, onClose }: AddTabletFormProps & { onClose: () => void }) {
  const { add } = useDeviceActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<DeviceFailure | null>(null);
  const [resolver] = useState(() => zodResolver(dealerTabletAddSchema));
  const form = useForm<z.input<typeof dealerTabletAddSchema>, unknown, z.output<typeof dealerTabletAddSchema>>({ resolver, defaultValues: { name: '' } });
  const submit = form.handleSubmit(async ({ name }) => {
    const added = await add.mutateAsync({ name });
    setFailure(added.ok ? null : added.error);
    if (!added.ok) return;
    if (added.value === null) toast(t('console.tablets.addedWithoutCode'));
    else onCode(added.value);
    onClose();
  });
  const nameField = form.register('name');
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={add.isPending} onClick={() => void submit()}>{t('console.tablets.add')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} footer={footer} title={t('console.tablets.addTitle')}>
      <Stack gap={3}>
        <Input {...nameField} label={t('console.tablets.name')} hint={t('console.tablets.nameHint')} autoComplete="off"
          error={form.formState.errors.name ? t('console.tablets.invalidName') : undefined}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} />
        {failure === null ? null : <ErrorMessage>{t(DEVICE_FAILURE_COPY[failure])}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}

/** Add a tablet, in the tablets' title row: it opens the panel, a fresh one each time. */
export function AddTabletForm(props: AddTabletFormProps) {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="compact" onClick={() => { setOpened(opened + 1); setIsOpen(true); }}>{t('console.tablets.addTitle')}</Button>
      {isOpen ? <AddTabletSheet key={opened} {...props} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
