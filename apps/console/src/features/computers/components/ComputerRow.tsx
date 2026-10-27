import { zodResolver } from '@hookform/resolvers/zod';
import { deviceRevokeSchema } from '@rivr/contracts';
import { useDeviceActions, type Computer, type DeviceFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, ReasonForm, Stack, Text } from '@rivr/ui';
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
  return (
    <ReasonForm field={form.register('reason')} label={t('console.computers.revokeReason')}
      error={form.formState.errors.reason ? t('console.computers.invalidReason') : undefined}
      actions={[{ label: t('console.computers.revokeConfirm'), onClick: () => void submit() }]}
      isLoading={revoke.isPending} onCancel={() => onDone(null)} />
  );
}

const KIND = { cage: 'console.computers.cage', console: 'console.computers.console' } as const;

/**
 * One computer: its name, what it is (or waits to be) enrolled as, and Revoke. The computer in use is
 * never revoked from itself, so no one shuts out the console they are working at.
 */
export function ComputerRow({ venueId, computer, isThisOne }: { venueId: string; computer: Computer; isThisOne: boolean }) {
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
          <Text variant="small" tone="muted">{t(KIND[computer.kind])}</Text>
          {computer.isEnrolled ? null : <Text variant="small" tone="muted">{t('console.computers.waiting')}</Text>}
        </Stack>
        {isThisOne ? null : <Button variant="text" onClick={() => setIsRevoking(true)}>{t('console.computers.revoke', { name: computer.name })}</Button>}
      </Inline>
      {isRevoking ? <RevokeForm venueId={venueId} computer={computer} onDone={done} /> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
