import { zodResolver } from '@hookform/resolvers/zod';
import { kycReviewSchema } from '@rivr/contracts';
import { useKycReviewActions, type KycReviewFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
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
  onDecided: () => void;
}

/**
 * Approving or rejecting a check waiting for review, with the reason in words: the form refuses a document number in it,
 * as the database does. Approve is the check's main action, cream; the screen's one gold button is Check in person.
 */
export function ReviewForm({ venueId, memberId, fullName, needsDateOfBirth, needsPan, onDecided }: ReviewFormProps) {
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
      if (decided.ok) onDecided();
    })();
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  const dateOfBirth = form.register('dateOfBirth');
  const pan = form.register('pan');
  const reason = form.register('reason');
  return (
    <Stack gap={3}>
      {needsDateOfBirth ? <Input {...dateOfBirth} type="date" label={t('console.kycReview.dateOfBirthFor', { name: fullName })} /> : null}
      {needsPan ? <Input {...pan} label={t('console.kycReview.panFor', { name: fullName })} maxLength={10} autoComplete="off" /> : null}
      {/* The console's filled field (console v3), its name inside it; the rule for the reason on the line above, as in the prototype. */}
      <Stack gap={2}>
        <Text variant="secondary" tone="muted">{t('console.kycReview.reasonHint')}</Text>
        <Input {...reason} variant="subtle" label={t('console.kycReview.reasonFor', { name: fullName })} maxLength={500} autoComplete="off" />
      </Stack>
      <Inline gap={3}>
        <Button variant="strong" size="compact" isLoading={review.isPending} onClick={decide(true)}>{t('console.kycReview.approve')}</Button>
        <Button variant="subtle" size="compact" isLoading={review.isPending} onClick={decide(false)}>{t('console.kycReview.reject')}</Button>
      </Inline>
      {/* One message covers all three fields, as before. */}
      {isInvalid ? <ErrorMessage>{t('console.kycReview.reasonInvalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
