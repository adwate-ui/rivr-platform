import { zodResolver } from '@hookform/resolvers/zod';
import { markerIssueSchema } from '@rivr/contracts';
import { useMarkerActions, type CageMember, type MarkerFailure } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { formatMoney, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Input, SignaturePad, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

const FAILURE_COPY: Readonly<Record<MarkerFailure, MessageKey>> = {
  no_shift: 'console.cage.noShift',
  not_allowed: 'console.cage.markerNotAllowed',
  above_limit: 'console.cage.markerAboveLimit',
  above_exposure: 'console.cage.markerAboveExposure',
  past_due: 'console.cage.markerPastDue',
  not_chips: 'console.cage.markerNotChips',
  unsigned: 'console.cage.markerUnsigned',
  not_set_up: 'console.cage.markerNotSetUp',
  switched_off: 'console.cage.markerSwitchedOff',
  stopped: 'console.cage.stopped',
  paused: 'console.cage.paused',
  kyc_needed: 'console.cage.kycBlock',
  under_age: 'console.cage.underAgeBlock',
  duplicate: 'console.cage.duplicateBlock',
  on_break: 'console.cage.onBreak',
  not_seated: 'console.cage.notSeatedBlock',
  invalid: 'console.cage.markerInvalid',
  own_record: 'console.cage.ownRecord',
  unavailable: 'console.cage.unavailable',
};

/**
 * A marker (#74; scope-v1 module 5): chips on credit to the seated member, who signs on the pad. It
 * posts to their markers, never their wallet; the database refuses it above their limit or the room's
 * cap, or while a marker of theirs is past due. Once per request id.
 */
export function MarkerForm({ venueId, member }: { venueId: string; member: CageMember }) {
  const { issue } = useMarkerActions(venueId);
  // A signature is for the amount shown when it was given: another amount asks the member to sign again.
  const [signature, setSignature] = useState<{ path: string; amount: string } | null>(null);
  // A new pad for the next marker.
  const [padKey, setPadKey] = useState(0);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<{ failure: MarkerFailure | null; issued: string | null }>({ failure: null, issued: null });
  const [resolver] = useState(() => zodResolver(markerIssueSchema));
  const form = useForm<z.input<typeof markerIssueSchema>, unknown, z.output<typeof markerIssueSchema>>({ resolver, defaultValues: { amount: '' } });
  const typed = useWatch({ control: form.control, name: 'amount' }).trim();
  const submit = form.handleSubmit(async ({ amount }) => {
    // A new amount gives a clean pad (its key), so a signature is always for the amount shown.
    if (signature === null || signature.amount !== amount) return setOutcome({ failure: 'unsigned', issued: null });
    const paise = fromRupees(BigInt(amount));
    const done = await issue.mutateAsync({ memberId: member.memberId, amount: paise, signature: signature.path, requestId });
    setOutcome(done.ok ? { failure: null, issued: formatMoney(paise) } : { failure: done.error, issued: null });
    if (done.ok) { form.reset(); setRequestId(crypto.randomUUID()); setSignature(null); setPadKey((key) => key + 1); }
  });
  const amount = form.register('amount', { onChange: () => setRequestId(crypto.randomUUID()) });
  const signFor = /^[1-9]\d{0,7}$/.test(typed) ? formatMoney(fromRupees(BigInt(typed))) : null;
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.cage.markerTitle')}</Heading>
      <Input {...amount} label={t('console.cage.markerAmount')} prefix={t('console.cage.rupee')} inputMode="numeric" autoComplete="off"
        error={form.formState.errors.amount ? t('console.cage.invalidAmount') : undefined} />
      <SignaturePad key={`${padKey}:${typed}`} onChange={(path) => setSignature(path === null ? null : { path, amount: typed })}
        label={signFor === null ? t('console.cage.signatureOf', { name: member.fullName }) : t('console.cage.signatureFor', { name: member.fullName, amount: signFor })} />
      <Button variant="secondary" isLoading={issue.isPending} onClick={() => void submit()}>{t('console.cage.issueMarker')}</Button>
      {outcome.failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[outcome.failure])}</ErrorMessage>}
      {outcome.issued === null ? null : <Text>{t('console.cage.markerIssued', { amount: outcome.issued })}</Text>}
    </Stack>
  );
}
