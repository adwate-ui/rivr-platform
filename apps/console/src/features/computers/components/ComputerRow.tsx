import { zodResolver } from '@hookform/resolvers/zod';
import { deviceRevokeSchema } from '@rivr/contracts';
import { useDeviceActions, type Computer, type DeviceFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<DeviceFailure, MessageKey>> = {
  not_allowed: 'console.computers.notAllowedAction',
  paused: 'console.computers.paused',
  invalid: 'console.computers.unavailable',
  unavailable: 'console.computers.unavailable',
};

/** Revokes a computer, with the reason: it stops working at once. */
function RevokeForm({ venueId, computer, onDone }: { venueId: string; computer: Computer; onDone: (failure: DeviceFailure | null) => void }) {
  const { revoke } = useDeviceActions(venueId);
  const [resolver] = useState(() => zodResolver(deviceRevokeSchema));
  const form = useForm<z.input<typeof deviceRevokeSchema>, unknown, z.output<typeof deviceRevokeSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => {
    const revoked = await revoke.mutateAsync({ deviceId: computer.deviceId, reason });
    onDone(revoked.ok ? null : revoked.error);
  });
  const reasonField = form.register('reason');
  return (
    <Inline gap={3} align="end">
      <Input {...reasonField} label={t('console.computers.revokeReason')} autoComplete="off"
        error={form.formState.errors.reason ? t('console.computers.invalidReason') : undefined} />
      <Button variant="danger" isLoading={revoke.isPending} onClick={() => void submit()}>{t('console.computers.revokeConfirm')}</Button>
      <Button variant="text" onClick={() => onDone(null)}>{t('common.cancel')}</Button>
    </Inline>
  );
}

/** One enrolled computer: its name, what it is enrolled as, and Revoke. */
export function ComputerRow({ venueId, computer }: { venueId: string; computer: Computer }) {
  const [isRevoking, setIsRevoking] = useState(false);
  const [failure, setFailure] = useState<DeviceFailure | null>(null);
  const done = (outcome: DeviceFailure | null) => {
    setFailure(outcome);
    setIsRevoking(false);
  };
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text weight="semibold">{computer.name}</Text>
          <Text variant="small" tone="muted">{t(computer.kind === 'cage' ? 'console.computers.cage' : 'console.computers.console')}</Text>
        </Stack>
        <Button variant="text" onClick={() => setIsRevoking(true)}>{t('console.computers.revoke', { name: computer.name })}</Button>
      </Inline>
      {isRevoking ? <RevokeForm venueId={venueId} computer={computer} onDone={done} /> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
