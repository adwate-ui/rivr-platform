import { zodResolver } from '@hookform/resolvers/zod';
import { eodReviewSchema } from '@rivr/contracts';
import { useEodActions, type EodClose, type EodFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { closeLine, closeStatus, EOD_FAILURE_COPY, figureRows } from './eodCopy.ts';

/** A manager who neither opened nor closed the shift gives the reason for its variance (#45). */
function ReviewForm({ venueId, close }: { venueId: string; close: EodClose }) {
  const { review } = useEodActions(venueId);
  const [failure, setFailure] = useState<EodFailure | null>(null);
  const [resolver] = useState(() => zodResolver(eodReviewSchema));
  const form = useForm<z.input<typeof eodReviewSchema>, unknown, z.output<typeof eodReviewSchema>>({ resolver, defaultValues: { reason: '' } });
  const reasonField = form.register('reason');
  const submit = form.handleSubmit(async (values) => {
    const done = await review.mutateAsync({ closeId: close.closeId, reason: values.reason });
    setFailure(done.ok ? null : done.error);
  });
  return (
    <Stack gap={3}>
      <Input {...reasonField} label={t('console.endOfDay.reasonFor')} autoComplete="off"
        error={form.formState.errors.reason ? t('console.endOfDay.reasonInvalid') : undefined} />
      {failure === null ? null : <ErrorMessage>{t(EOD_FAILURE_COPY[failure])}</ErrorMessage>}
      <Inline>
        <Button variant="secondary" isLoading={review.isPending} onClick={() => void submit()}>{t('console.endOfDay.recordReason')}</Button>
      </Inline>
    </Stack>
  );
}

/**
 * One close (#45): when and by whom, each figure counted, expected and its variance, and where it stands.
 * An anomaly waiting for its reason offers the review to a manager who neither opened nor closed it.
 */
export function CloseCard({ venueId, close }: { venueId: string; close: EodClose }) {
  const isWaiting = close.isAnomaly && close.review === null;
  return (
    <Stack gap={3}>
      <Heading level={3}>{closeLine(close)}</Heading>
      {figureRows(close).map((row) => (
        <Inline key={row.label} justify="between" gap={4} wrap>
          <Text tone="muted">{row.label}</Text>
          <Text weight={row.isOut ? 'semibold' : 'regular'}>{row.text}</Text>
        </Inline>
      ))}
      {isWaiting ? (
        <Box surface="alert" padding={3} radius="sm"><Text tone="onAlert">{closeStatus(close)}</Text></Box>
      ) : (
        <Text tone={close.isAnomaly ? 'default' : 'money'}>{closeStatus(close)}</Text>
      )}
      {isWaiting && !close.mayReview ? <Text variant="small" tone="muted">{t('console.endOfDay.waitingForManager')}</Text> : null}
      {close.mayReview ? <ReviewForm venueId={venueId} close={close} /> : null}
    </Stack>
  );
}
