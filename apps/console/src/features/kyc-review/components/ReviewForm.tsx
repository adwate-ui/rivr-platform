import { zodResolver } from '@hookform/resolvers/zod';
import { kycReviewSchema } from '@rivr/contracts';
import { useKycReviewActions, type KycReviewFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Input, ReasonForm, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FAILURE_COPY } from './checkText.ts';

interface ReviewFormProps {
  venueId: string;
  memberId: string;
  fullName: string;
  /** The check kept no date of birth: approving needs the one on the original document. */
  needsDateOfBirth: boolean;
  /** The check kept no PAN: approving needs the one on the original card, so the gate can look for a duplicate. */
  needsPan: boolean;
}

/** Approving or rejecting a check waiting for review, with the reason. The database keeps the gate. */
export function ReviewForm({ venueId, memberId, fullName, needsDateOfBirth, needsPan }: ReviewFormProps) {
  const { review } = useKycReviewActions(venueId);
  const [failure, setFailure] = useState<KycReviewFailure | null>(null);
  const [resolver] = useState(() => zodResolver(kycReviewSchema));
  const form = useForm<z.input<typeof kycReviewSchema>, unknown, z.output<typeof kycReviewSchema>>({
    resolver, defaultValues: { reason: '', dateOfBirth: '', pan: '' },
  });
  /** The press handler for one decision: checks the form, then sends it. */
  const decide = (approve: boolean) => () =>
    void form.handleSubmit(async ({ reason, dateOfBirth, pan }) => {
      const decided = await review.mutateAsync({ memberId, approve, reason, dateOfBirth, pan });
      setFailure(decided.ok ? null : decided.error);
    })();
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  const dateOfBirth = form.register('dateOfBirth');
  const pan = form.register('pan');
  const decisions = [
    { label: t('console.kycReview.approve'), onClick: decide(true) },
    { label: t('console.kycReview.reject'), onClick: decide(false) },
  ];
  // ReasonForm draws the decisions straight under the reason, so the document fields come first. One
  // message under the decisions covers all three fields, as before, so the reason gets no error of its own.
  return (
    <Stack gap={3}>
      {needsDateOfBirth ? <Input {...dateOfBirth} type="date" label={t('console.kycReview.dateOfBirthFor', { name: fullName })} /> : null}
      {needsPan ? <Input {...pan} label={t('console.kycReview.panFor', { name: fullName })} maxLength={10} autoComplete="off" /> : null}
      <ReasonForm field={form.register('reason')} label={t('console.kycReview.reasonFor', { name: fullName })} hint={t('console.kycReview.reasonHint')}
        maxLength={500} variant="secondary" actions={decisions} isLoading={review.isPending} />
      {isInvalid ? <ErrorMessage>{t('console.kycReview.reasonInvalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
