import { useReverseBonus, type CorrectBonusFailure, type MemberBonusLine } from '@rivr/db/bonus';
import { formatChips, formatDate, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';

/** A Bonus given to reverse, with the line of what expired of it, if any. */
export interface Reversing {
  readonly line: MemberBonusLine;
  readonly expired: MemberBonusLine | null;
}

/**
 * Reverse a Bonus given (#1077, the owner, 18 Nov), for super admins, from its row: all of it comes back, even if part was
 * used, less what expired (the sheet says what did), so the balance may go below zero; a reason kept on the record (the
 * member sees none, the owner, 19 Nov), then Reverse: the sheet is the second ask, as Refuse's. The toast says what came
 * back, as the database worked it out. The database refuses anyone else.
 */
export function ReverseBonus({ venueId, memberId, reversing, onClose }: { venueId: string; memberId: string; reversing: Reversing; onClose: () => void }) {
  const reverse = useReverseBonus(venueId, memberId);
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<CorrectBonusFailure | null>(null);
  const { line, expired } = reversing;
  const submit = async () => {
    const done = await reverse.mutateAsync({ grantId: line.id, reason: reason.trim() });
    if (!done.ok) {
      setFailure(done.error);
      return;
    }
    toast(done.value === null ? t('console.members.bonus.reverse.already') : t('console.members.bonus.reverse.done', { chips: formatChips(done.value) }));
    onClose();
  };
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('console.members.bonus.reverse.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={reverse.isPending} isDisabled={reason.trim().length < 3} onClick={() => void submit()}>
        {t('console.members.bonus.reverse.action')}
      </Button>
    </Inline>
  );
  return (
    <Sheet isOpen place="console" onClose={onClose} title={t('console.members.bonus.reverse.title')} footer={footer}
      subtitle={t('console.members.bonus.reverse.what', { chips: formatChips(line.amount), date: formatDate(new Date(line.at)), reason: line.reason ?? '' })}>
      <Stack gap={4}>
        {expired === null ? null : <Text tone="muted">{t('console.members.bonus.reverse.expired', { chips: formatChips(expired.amount) })}</Text>}
        <Input label={t('console.members.bonus.reverse.reason')} hint={t('console.members.bonus.reverse.reasonHint')} value={reason} maxLength={200}
          autoComplete="off" onChange={(event) => { setReason(event.target.value); setFailure(null); }} />
        {failure === null ? null : <ErrorMessage>{t(`console.members.bonus.reverse.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
