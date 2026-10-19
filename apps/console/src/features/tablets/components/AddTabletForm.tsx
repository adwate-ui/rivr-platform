import { useDeviceActions, type DeviceFailure, type PairingCode } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { DEVICE_FAILURE_COPY } from './failureCopy.ts';

interface AddTabletFormProps {
  venueId: string;
  staffId: string;
  /** The new tablet's pairing code, to show on its row. */
  onCode: (code: PairingCode) => void;
}

/** Adds a dealer tablet by name and starts pairing it: the code shows on its row. */
export function AddTabletForm({ venueId, staffId, onCode }: AddTabletFormProps) {
  const { add } = useDeviceActions(venueId);
  const [name, setName] = useState('');
  const [failure, setFailure] = useState<DeviceFailure | 'no_name' | null>(null);
  const addNow = async () => {
    if (name.trim() === '') {
      setFailure('no_name');
      return;
    }
    const added = await add.mutateAsync({ name, staffId });
    setFailure(added.ok ? null : added.error);
    if (added.ok && added.value !== null) {
      onCode(added.value);
      setName('');
    }
  };
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input label={t('console.tablets.name')} hint={t('console.tablets.nameHint')} value={name}
          onChange={(event) => setName(event.target.value)} autoComplete="off" />
        <Button variant="secondary" isLoading={add.isPending} onClick={() => void addNow()}>{t('console.tablets.add')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(failure === 'no_name' ? 'console.tablets.invalidName' : DEVICE_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
