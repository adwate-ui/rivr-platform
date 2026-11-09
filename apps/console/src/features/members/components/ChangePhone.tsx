import { useChangeMemberPhone, type PhoneChangeFailure } from '@rivr/db';
import { formatMobile, formatTypedMobile, t, type MessageKey } from '@rivr/i18n';
import { ConfirmButton, ErrorMessage, Heading, Input, Stack, Text, StatusMessage } from '@rivr/ui';
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

// Every number here is Indian: the field fixes the prefix, and takes the ten digits (audit F-080).
const INDIA_PREFIX = '+91';
const withPrefix = (typed: string) => `${INDIA_PREFIX}${typed.replace(/\D/g, '')}`;

interface NumberFieldsProps {
  phone: string;
  again: string;
  onPhone: (phone: string) => void;
  onAgain: (again: string) => void;
}

/** The new number, then typed again, which must match (F1-09). */
function NumberFields({ phone, again, onPhone, onAgain }: NumberFieldsProps) {
  const differs = again.trim() !== '' && again.trim() !== phone.trim();
  return (
    <>
      <Input label={t('console.members.changePhone.newNumber')} hint={t('console.members.changePhone.newNumberHint')} prefix={INDIA_PREFIX} value={phone} inputMode="tel"
        autoComplete="off" onChange={(event) => onPhone(formatTypedMobile(event.target.value))} />
      <Input label={t('console.members.changePhone.again')} prefix={INDIA_PREFIX} value={again} inputMode="tel" autoComplete="off"
        error={differs ? t('console.members.changePhone.differs') : undefined} onChange={(event) => onAgain(formatTypedMobile(event.target.value))} />
    </>
  );
}

/**
 * A super admin changes a member's phone number, which is their login (#502, decision 0248): the number now, the new
 * one twice and a reason, then Change, asked twice (F1-09). Members never change it themselves; the change is audited
 * and the owner alerted.
 */
export function ChangePhone({ venueId, memberId, currentPhone }: { venueId: string; memberId: string; currentPhone: string | null }) {
  const change = useChangeMemberPhone(venueId, memberId);
  const [phone, setPhone] = useState('');
  const [again, setAgain] = useState('');
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    const done = await change.mutateAsync({ phone: withPrefix(phone), reason });
    setOutcome(done.ok ? { ok: true, text: t('console.members.changePhone.changed') } : { ok: false, text: t(FAILURE_COPY[done.error]) });
    if (done.ok) {
      setPhone('');
      setAgain('');
      setReason('');
    }
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.members.changePhone.title')}</Heading>
      <Text tone="muted">{t('console.members.changePhone.intro')}</Text>
      {currentPhone === null ? null : <Text>{t('console.members.changePhone.current', { phone: formatMobile(currentPhone) })}</Text>}
      <NumberFields phone={phone} again={again} onPhone={setPhone} onAgain={setAgain} />
      <Input label={t('console.members.changePhone.reason')} value={reason} maxLength={300} autoComplete="off" onChange={(event) => setReason(event.target.value)} />
      <Stack align="start">
        <ConfirmButton variant="subtle" label={t('console.members.changePhone.change')} confirm={t('console.members.changePhone.confirm', { phone: withPrefix(phone) })}
          isDisabled={phone.trim() === '' || again.trim() !== phone.trim() || reason.trim().length < 3} isBusy={change.isPending} onConfirm={() => void submit()} />
      </Stack>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
