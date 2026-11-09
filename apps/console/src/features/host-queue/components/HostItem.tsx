import { HOST_CHURN_REASONS, hostContactSchema, type HostChurnReason } from '@rivr/contracts';
import { useHostQueueActions, type HostQueueFailure, type HostQueueItem } from '@rivr/db/hostQueue';
import { formatDate, formatMobile, t, formatHostOffer } from '@rivr/i18n';
import { Button, ChoiceChips, ConfirmButton, ErrorMessage, Heading, Inline, Input, Stack, StatusMessage, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { OFFER_KINDS, offerDraft, offerFrom, type OfferKind } from './offer.ts';

/** The call as the host fills it in: the reason, the offer and its amount or words, and a note. */
function useCallForm(item: HostQueueItem) {
  const [reason, setReason] = useState<HostChurnReason | null>(item.reason);
  // The offer already made, so saving the call again keeps it.
  const [kind, setKind] = useState<OfferKind>(() => offerDraft(item.offer).kind);
  const [value, setValue] = useState(() => offerDraft(item.offer).value);
  const [note, setNote] = useState(item.note ?? '');
  return { reason, setReason, kind, setKind, value, setValue, note, setNote, offer: offerFrom(kind, value) };
}

type CallForm = ReturnType<typeof useCallForm>;

/** Why the player stopped coming, and the offer, with its amount or words where it takes one. */
function CallFields({ form }: { form: CallForm }) {
  return (
    <>
      <ChoiceChips label={t('console.hostQueue.reasonFor')} mode="one" look="subtle" selected={form.reason === null ? [] : [form.reason]}
        options={HOST_CHURN_REASONS.map((value) => ({ value, label: t(`console.hostQueue.reasons.${value}`) }))} onChange={(chosen) => form.setReason(chosen[0] ?? null)} />
      <ChoiceChips label={t('console.hostQueue.offerTo')} mode="one" look="subtle" selected={[form.kind]}
        options={OFFER_KINDS.map((value) => ({ value, label: t(`console.hostQueue.kinds.${value}`) }))}
        onChange={(chosen) => { form.setKind(chosen[0] ?? 'none'); form.setValue(''); }} />
      {form.kind === 'points' || form.kind === 'bonus' || form.kind === 'message'
        ? <Input label={t(`console.hostQueue.values.${form.kind}`)} value={form.value} maxLength={500} onChange={(event) => form.setValue(event.target.value)}
          error={form.value.trim() !== '' && form.offer === undefined ? t(`console.hostQueue.invalid.${form.kind}`) : undefined} />
        : null}
      <TextArea label={t('console.hostQueue.note')} rows={3} maxLength={500} value={form.note} onChange={(event) => form.setNote(event.target.value)} />
    </>
  );
}

/** The first refusal among the latest outcomes, if any. */
function refusalOf(...outcomes: ({ ok: true } | { ok: false; error: HostQueueFailure } | undefined)[]): HostQueueFailure | null {
  for (const outcome of outcomes) if (outcome?.ok === false) return outcome.error;
  return null;
}

/** Who to call: the name, their number and lapse, and the offer made so far. */
function Who({ item }: { item: HostQueueItem }) {
  return (
    <Stack gap={1}>
      <Heading level={2} variant="section">{item.fullName}</Heading>
      <Text variant="secondary" tone="muted">
        {t('console.hostQueue.lapse', { phone: formatMobile(item.phone), last: formatDate(new Date(item.lastVisitAt)), visits: String(item.visits) })}
      </Text>
      {item.offer === null ? null : <Text variant="secondary">{t('console.hostQueue.offered', { offer: formatHostOffer(item.offer) })}</Text>}
    </Stack>
  );
}

/**
 * One lapsed regular's call (#165): why they stopped coming, which a call must say (console v3), the offer and a note;
 * saved, said once saved; or the player taken off the queue, asked twice as it is for good (F2-19).
 */
export function HostItem({ venueId, item }: { venueId: string; item: HostQueueItem }) {
  const { record, close } = useHostQueueActions(venueId);
  const form = useCallForm(item);
  const [isAsked, setAsked] = useState(false);
  const name = item.fullName;
  const refusal = refusalOf(record.data, close.data);
  const save = () => {
    setAsked(true);
    const contact = hostContactSchema.safeParse({ reason: form.reason, offer: form.offer, note: form.note.trim() === '' ? null : form.note.trim() });
    if (contact.success) record.mutate({ itemId: item.itemId, contact: contact.data });
  };
  return (
    <Stack gap={5}>
      <Who item={item} />
      <CallFields form={form} />
      {isAsked && form.reason === null ? <ErrorMessage>{t('console.hostQueue.needReason')}</ErrorMessage> : null}
      <Inline gap={2} wrap>
        <Button variant="primary" size="compact" aria-label={t('console.hostQueue.saveName', { name })} isDisabled={form.offer === undefined}
          isLoading={record.isPending} onClick={save}>{t('console.hostQueue.save')}</Button>
        <ConfirmButton variant="subtle" size="compact" label={t('console.hostQueue.close')} name={t('console.hostQueue.closeName', { name })}
          confirm={t('console.hostQueue.closeConfirm', { name })} isBusy={close.isPending} onConfirm={() => close.mutate(item.itemId)} />
      </Inline>
      <StatusMessage>{record.data?.ok === true ? t('console.hostQueue.saved', { name }) : null}</StatusMessage>
      {refusal === null ? null : <ErrorMessage>{t(`console.hostQueue.failures.${refusal}`)}</ErrorMessage>}
    </Stack>
  );
}
