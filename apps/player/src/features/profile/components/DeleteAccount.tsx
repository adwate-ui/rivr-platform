import { useMyErasureRequest, useRequestMyErasure } from '@rivr/db';
import { formatDayMonth, t } from '@rivr/i18n';
import { Button, DetailRow, ErrorMessage, Sheet, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';

/** What deleting does, and the one action that asks for it. Sent, the sheet closes and a toast says so. */
function DeleteSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const request = useRequestMyErasure();
  const [hasFailed, setHasFailed] = useState(false);
  const send = async () => {
    const sent = await request.mutateAsync();
    setHasFailed(!sent.ok);
    if (!sent.ok) return;
    toast(t('player.profile.deleteSent'));
    onClose();
  };
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('player.profile.deleteAccount')}>
      <Stack gap={4}>
        <Text>{t('player.profile.deleteWhen')}</Text>
        <Text>{t('player.profile.deleteForfeit')}</Text>
        <Text>{t('player.profile.deleteKept')}</Text>
        <Text>{t('player.profile.deleteConfirmed')}</Text>
        <Button variant="danger" size="tall" fullWidth isLoading={request.isPending} onClick={() => void send()}>{t('player.profile.deleteSend')}</Button>
        {hasFailed ? <ErrorMessage look="dot">{t('player.profile.deleteNotSent')}</ErrorMessage> : null}
      </Stack>
    </Sheet>
  );
}

/**
 * Delete my account (#813, decision 0574), as both app stores require: a row that opens what deleting does; once asked, the
 * day it was asked. While that is not known the row still opens, as asking twice is no fault.
 */
export function DeleteAccountRow() {
  const requestedAt = useMyErasureRequest().data ?? null;
  const [isOpen, setOpen] = useState(false);
  if (requestedAt !== null) {
    return (
      <DetailRow label={t('player.profile.deleteAccount')} value={t('player.profile.deleteRequested', { date: formatDayMonth(new Date(requestedAt)) })}
        valueTone="accent" isLast />
    );
  }
  return (
    <>
      <DetailRow label={t('player.profile.deleteAccount')} onOpen={() => setOpen(true)} isLast />
      <DeleteSheet isOpen={isOpen} onClose={() => setOpen(false)} />
    </>
  );
}
