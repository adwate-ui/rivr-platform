import { zodResolver } from '@hookform/resolvers/zod';
import { kycReviewSchema } from '@rivr/contracts';
import { useKycReviewActions, type KycReviewFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
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
}

/** Approving or rejecting a check waiting for review, with the reason. The database keeps the gate. */
export function ReviewForm({ venueId, memberId, fullName, needsDateOfBirth }: ReviewFormProps) {
  const { review } = useKycReviewActions(venueId);
  const [failure, setFailure] = useState<KycReviewFailure | null>(null);
  const [resolver] = useState(() => zodResolver(kycReviewSchema));
  const form = useForm<z.input<typeof kycReviewSchema>, unknown, z.output<typeof kycReviewSchema>>({
    resolver, defaultValues: { reason: '', dateOfBirth: '' },
  });
  const decide = (approve: boolean) =>
    form.handleSubmit(async ({ reason, dateOfBirth }) => {
      const decided = await review.mutateAsync({ memberId, approve, reason, dateOfBirth });
      setFailure(decided.ok ? null : decided.error);
    });
  const isInvalid = Object.keys(form.formState.errors).length > 0;
  const reason = form.register('reason');
  const dateOfBirth = form.register('dateOfBirth');
  return (
    <Stack gap={3}>
      <Input {...reason} label={t('console.kycReview.reasonFor', { name: fullName })} hint={t('console.kycReview.reasonHint')} maxLength={500} autoComplete="off" />
      {needsDateOfBirth ? <Input {...dateOfBirth} type="date" label={t('console.kycReview.dateOfBirthFor', { name: fullName })} /> : null}
      <Inline gap={3}>
        <Button variant="secondary" isLoading={review.isPending} onClick={() => void decide(true)()}>
          {t('console.kycReview.approve')}
        </Button>
        <Button variant="secondary" isLoading={review.isPending} onClick={() => void decide(false)()}>
          {t('console.kycReview.reject')}
        </Button>
      </Inline>
      {isInvalid ? <ErrorMessage>{t('console.kycReview.reasonInvalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
