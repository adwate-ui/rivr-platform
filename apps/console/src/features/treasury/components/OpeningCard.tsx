import { zodResolver } from '@hookform/resolvers/zod';
import { eodReviewSchema } from '@rivr/contracts';
import { useEodActions, type EodFailure, type ShiftOpening } from '@rivr/db';
import { formatDayTime, formatMoney, t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EOD_FAILURE_COPY } from './eodCopy.ts';

/** A manager who neither opened this shift nor closed the last gives the reason its opening differed (#376). */
function OpeningReviewForm({ venueId, opening }: { venueId: string; opening: ShiftOpening }) {
  const { reviewOpening } = useEodActions(venueId);
  const [failure, setFailure] = useState<EodFailure | null>(null);
  const [resolver] = useState(() => zodResolver(eodReviewSchema));
  const form = useForm<z.input<typeof eodReviewSchema>, unknown, z.output<typeof eodReviewSchema>>({ resolver, defaultValues: { reason: '' } });
  const reasonField = form.register('reason');
  const submit = form.handleSubmit(async (values) => {
    const done = await reviewOpening.mutateAsync({ shiftId: opening.shiftId, reason: values.reason });
    setFailure(done.ok ? null : done.error);
  });
  return (
    <Stack gap={3}>
      <Input {...reasonField} label={t('console.endOfDay.reasonForOpening')} autoComplete="off"
        error={form.formState.errors.reason ? t('console.endOfDay.reasonInvalid') : undefined} />
      {failure === null ? null : <ErrorMessage>{t(EOD_FAILURE_COPY[failure])}</ErrorMessage>}
      <Inline>
        <Button variant="secondary" isLoading={reviewOpening.isPending} onClick={() => void submit()}>{t('console.endOfDay.recordReason')}</Button>
      </Inline>
    </Stack>
  );
}

/**
 * A shift whose opening differed from the last close (#376): when and by whom it opened, the float and the
 * chips against what that close counted, and its review, which a manager gives as at the close.
 */
export function OpeningCard({ venueId, opening }: { venueId: string; opening: ShiftOpening }) {
  const isWaiting = opening.review === null;
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.endOfDay.openingLine', { opened: formatDayTime(new Date(opening.openedAt)), name: opening.openedBy })}</Heading>
      <Text>{t('console.endOfDay.openingCash', { variance: formatMoney(opening.cashVariance) })}</Text>
      <Text>{t('console.endOfDay.openingChips', { variance: formatMoney(opening.chipsVariance) })}</Text>
      {opening.review === null ? (
        <Box surface="alert" padding={3} radius="sm"><Text tone="onAlert">{t('console.endOfDay.openingWaiting')}</Text></Box>
      ) : (
        <Text>{t('console.endOfDay.reviewed', { name: opening.review.reviewedBy, reason: opening.review.reason })}</Text>
      )}
      {isWaiting && opening.mayReview ? <OpeningReviewForm venueId={venueId} opening={opening} /> : null}
    </Stack>
  );
}
