import { HOST_CHURN_REASONS, hostContactSchema, type HostChurnReason } from '@rivr/contracts';
import { useHostQueueActions, type HostQueueFailure, type HostQueueItem } from '@rivr/db/hostQueue';
import { formatDate, formatMobile, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { OFFER_KINDS, offerDraft, offerFrom, offerText, type OfferKind } from './offer.ts';

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
function CallFields({ name, form }: { name: string; form: CallForm }) {
  return (
    <>
      <ChoiceChips label={t('console.hostQueue.reasonFor', { name })} mode="one" selected={form.reason === null ? [] : [form.reason]}
        options={HOST_CHURN_REASONS.map((value) => ({ value, label: t(`console.hostQueue.reasons.${value}`) }))} onChange={(chosen) => form.setReason(chosen[0] ?? null)} />
      <ChoiceChips label={t('console.hostQueue.offerTo', { name })} mode="one" selected={[form.kind]}
        options={OFFER_KINDS.map((value) => ({ value, label: t(`console.hostQueue.kinds.${value}`) }))}
        onChange={(chosen) => { form.setKind(chosen[0] ?? 'none'); form.setValue(''); }} />
      {form.kind === 'points' || form.kind === 'bonus' || form.kind === 'message'
        ? <Input label={t(`console.hostQueue.values.${form.kind}`, { name })} value={form.value} maxLength={500} onChange={(event) => form.setValue(event.target.value)}
          error={form.value.trim() !== '' && form.offer === undefined ? t(`console.hostQueue.invalid.${form.kind}`) : undefined} />
        : null}
      <TextArea label={t('console.hostQueue.note', { name })} rows={2} maxLength={500} value={form.note} onChange={(event) => form.setNote(event.target.value)} />
    </>
  );
}

/** The first refusal among the latest outcomes, if any. */
function refusalOf(...outcomes: ({ ok: true } | { ok: false; error: HostQueueFailure } | undefined)[]): HostQueueFailure | null {
  for (const outcome of outcomes) if (outcome?.ok === false) return outcome.error;
  return null;
}

/** One lapsed regular (#165): their lapse, the offer made so far, and the host's call: save it, or close the player. */
export function HostItem({ venueId, item }: { venueId: string; item: HostQueueItem }) {
  const { record, close } = useHostQueueActions(venueId);
  const form = useCallForm(item);
  const name = item.fullName;
  const refusal = refusalOf(record.data, close.data);
  const save = () => {
    const contact = hostContactSchema.safeParse({ reason: form.reason, offer: form.offer, note: form.note.trim() === '' ? null : form.note.trim() });
    if (contact.success) record.mutate({ itemId: item.itemId, contact: contact.data });
  };
  return (
    <Stack gap={3}>
      <Heading level={2} variant="section">{name}</Heading>
      <Text variant="small" tone="muted">
        {t('console.hostQueue.lapse', { phone: formatMobile(item.phone), last: formatDate(new Date(item.lastVisitAt)), visits: String(item.visits) })}
      </Text>
      {item.offer === null ? null : <Text>{t('console.hostQueue.offered', { offer: offerText(item.offer) })}</Text>}
      <CallFields name={name} form={form} />
      <Inline gap={2} wrap>
        <Button variant="primary" isDisabled={form.reason === null || form.offer === undefined || record.isPending} onClick={save}>{t('console.hostQueue.save', { name })}</Button>
        <Button variant="secondary" isDisabled={close.isPending} onClick={() => close.mutate(item.itemId)}>{t('console.hostQueue.close', { name })}</Button>
      </Inline>
      {refusal === null ? null : <ErrorMessage>{t(`console.hostQueue.failures.${refusal}`)}</ErrorMessage>}
    </Stack>
  );
}
