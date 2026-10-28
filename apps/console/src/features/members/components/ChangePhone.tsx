import { useChangeMemberPhone, type PhoneChangeFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Input, Stack, Text, StatusMessage } from '@rivr/ui';
import { useState } from 'react';

const FAILURE_COPY: Readonly<Record<PhoneChangeFailure, MessageKey>> = {
  not_allowed: 'console.members.changePhone.failures.not_allowed',
  invalid: 'console.members.changePhone.failures.invalid',
  taken: 'console.members.changePhone.failures.taken',
  staff_login: 'console.members.changePhone.failures.staff_login',
  erased: 'console.members.changePhone.failures.erased',
  paused: 'console.members.changePhone.failures.paused',
  too_many: 'console.members.changePhone.failures.too_many',
  unavailable: 'console.members.changePhone.failures.unavailable',
};

/**
 * A super admin changes a member's phone number, which is their login (#502, decision 0248): the new number and a
 * reason, then Change. Members never change it themselves; the change is audited and the owner alerted.
 */
export function ChangePhone({ venueId, memberId }: { venueId: string; memberId: string }) {
  const change = useChangeMemberPhone(venueId, memberId);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    const done = await change.mutateAsync({ phone, reason });
    setOutcome(done.ok ? { ok: true, text: t('console.members.changePhone.changed') } : { ok: false, text: t(FAILURE_COPY[done.error]) });
    if (done.ok) {
      setPhone('');
      setReason('');
    }
  };
  return (
    <Stack gap={3}>
      <Heading level={2} variant="section">{t('console.members.changePhone.title')}</Heading>
      <Text tone="muted">{t('console.members.changePhone.intro')}</Text>
      <Input label={t('console.members.changePhone.newNumber')} hint={t('console.members.changePhone.newNumberHint')} value={phone} inputMode="tel"
        autoComplete="off" onChange={(event) => setPhone(event.target.value)} />
      <Input label={t('console.members.changePhone.reason')} value={reason} maxLength={300} autoComplete="off" onChange={(event) => setReason(event.target.value)} />
      <Stack align="start">
        <Button variant="secondary" isDisabled={phone.trim() === '' || reason.trim().length < 3} isLoading={change.isPending} onClick={() => void submit()}>
          {t('console.members.changePhone.change')}
        </Button>
      </Stack>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
