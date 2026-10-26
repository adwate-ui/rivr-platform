import { zodResolver } from '@hookform/resolvers/zod';
import { deviceRevokeSchema } from '@rivr/contracts';
import { useDeviceActions, type DealerTablet, type DeviceFailure, type FloorTable, type PairingCode } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { DEVICE_FAILURE_COPY } from './failureCopy.ts';

type Outcome = { ok: true } | { ok: false; error: DeviceFailure };

/** Revokes a lost or replaced tablet, with the reason: its session is nobody from then on. */
function RevokeForm({ venueId, tablet, onDone }: { venueId: string; tablet: DealerTablet; onDone: (outcome: Outcome | null) => void }) {
  const { revoke } = useDeviceActions(venueId);
  const [resolver] = useState(() => zodResolver(deviceRevokeSchema));
  const form = useForm<z.input<typeof deviceRevokeSchema>, unknown, z.output<typeof deviceRevokeSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => onDone(await revoke.mutateAsync({ deviceId: tablet.deviceId, reason })));
  const reasonField = form.register('reason');
  return (
    <Inline gap={3} align="end">
      <Input {...reasonField} label={t('console.tablets.revokeReason')} autoComplete="off"
        error={form.formState.errors.reason ? t('console.tablets.invalidReason') : undefined} />
      <Button variant="danger" isLoading={revoke.isPending} onClick={() => void submit()}>{t('console.tablets.revokeConfirm')}</Button>
      <Button variant="text" onClick={() => onDone(null)}>{t('common.cancel')}</Button>
    </Inline>
  );
}

/** The table a dealer tablet is fixed to; a door kiosk has none. */
function TableChoice({ venueId, tablet, tables, onResult }: { venueId: string; tablet: DealerTablet; tables: readonly FloorTable[]; onResult: (outcome: Outcome) => void }) {
  const { assign } = useDeviceActions(venueId);
  const fixTo = async (tableId: string | undefined) => {
    if (tableId !== undefined) onResult(await assign.mutateAsync({ deviceId: tablet.deviceId, tableId }));
  };
  return (
    <ChoiceChips label={t('console.tablets.table', { name: tablet.name })} mode="one" selected={tablet.tableId === null ? [] : [tablet.tableId]}
      isDisabled={assign.isPending} onChange={(ids) => void fixTo(ids[0])} options={tables.map((table) => ({ value: table.id, label: table.name }))} />
  );
}

interface TabletRowProps {
  venueId: string;
  tablet: DealerTablet;
  /** The venue's tables, one of which the tablet is fixed to. */
  tables: readonly FloorTable[];
  /** The code given out for this tablet on this screen, if any. */
  code: PairingCode | null;
  onCode: (code: PairingCode) => void;
}

/** One dealer tablet or door kiosk: paired or not, its code while pairing, a tablet's table, a new code and Revoke. */
export function TabletRow({ venueId, tablet, tables, code, onCode }: TabletRowProps) {
  const { pair } = useDeviceActions(venueId);
  const [isRevoking, setIsRevoking] = useState(false);
  const [failure, setFailure] = useState<DeviceFailure | null>(null);
  const settle = (outcome: Outcome) => setFailure(outcome.ok ? null : outcome.error);
  const newCode = async () => {
    const paired = await pair.mutateAsync(tablet.deviceId);
    settle(paired);
    if (paired.ok && paired.value !== null) onCode(paired.value);
  };
  const name = tablet.name;
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text weight="semibold">{name}</Text>
          {tablet.isDoor ? <Text variant="small">{t('console.tablets.doorKiosk')}</Text> : null}
          <Text variant="small" tone="muted">{t(tablet.isPaired ? 'console.tablets.paired' : 'console.tablets.notPaired')}</Text>
          {code === null ? null : <Text>{t('console.tablets.code', { code: code.code, time: formatTime(new Date(code.expiresAt)) })}</Text>}
        </Stack>
        <Inline gap={2} wrap>
          <Button variant="secondary" isLoading={pair.isPending} onClick={() => void newCode()}>{t('console.tablets.newCode', { name })}</Button>
          <Button variant="text" onClick={() => setIsRevoking(true)}>{t('console.tablets.revoke', { name })}</Button>
        </Inline>
      </Inline>
      {tablet.isDoor ? null : <TableChoice venueId={venueId} tablet={tablet} tables={tables} onResult={settle} />}
      {isRevoking ? (
        <RevokeForm venueId={venueId} tablet={tablet} onDone={(outcome) => {
          setIsRevoking(false);
          if (outcome !== null) settle(outcome);
        }} />
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(DEVICE_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
