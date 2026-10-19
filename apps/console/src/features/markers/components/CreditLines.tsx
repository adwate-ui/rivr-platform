import { useCreditActions, useCreditLines, type CreditFailure, type CreditLine } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CREDIT_FAILURE_COPY } from './creditCopy.ts';

/** One member's line: their limit and open markers; a limit waiting, with Approve and Decline for a super admin. */
function LineRow({ venueId, line, canDecide, onResult }: { venueId: string; line: CreditLine; canDecide: boolean; onResult: (failure: CreditFailure | null) => void }) {
  const { decide } = useCreditActions(venueId);
  // The decision is for the limit shown: if another was asked meanwhile, the database refuses it.
  const choose = (isApproved: boolean) => {
    if (line.proposed === null) return;
    void decide.mutateAsync({ lineId: line.lineId, isApproved, expected: line.proposed.limit }).then((done) => onResult(done.ok ? null : done.error));
  };
  return (
    <Inline gap={4} justify="between" align="center">
      <Stack gap={1}>
        <Text weight="medium">{line.fullName}</Text>
        <Text variant="small" tone="muted">{t('console.markers.lineSummary', { limit: formatMoney(line.limit), outstanding: formatMoney(line.outstanding) })}</Text>
        {line.proposed === null ? null : (
          <Text variant="small">{t('console.markers.waiting', { limit: formatMoney(line.proposed.limit), by: line.proposed.by, reason: line.proposed.reason })}</Text>
        )}
      </Stack>
      {canDecide && line.proposed !== null ? (
        <Inline gap={2}>
          <Button variant="primary" isDisabled={decide.isPending} aria-label={t('console.markers.approveName', { name: line.fullName })} onClick={() => choose(true)}>
            {t('console.markers.approve')}
          </Button>
          <Button variant="text" isDisabled={decide.isPending} aria-label={t('console.markers.declineName', { name: line.fullName })} onClick={() => choose(false)}>
            {t('console.markers.decline')}
          </Button>
        </Inline>
      ) : null}
    </Inline>
  );
}

/** The venue's credit lines, those waiting for approval first (#73). */
export function CreditLines({ venueId, isSuperAdmin }: { venueId: string; isSuperAdmin: boolean }) {
  const lines = useCreditLines(venueId);
  const [failure, setFailure] = useState<CreditFailure | null>(null);
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.markers.lines')}</Heading>
      {failure === null ? null : <ErrorMessage>{t(CREDIT_FAILURE_COPY[failure])}</ErrorMessage>}
      {lines.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {lines.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
          <Button onClick={() => void lines.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {lines.data?.length === 0 ? <Text tone="muted">{t('console.markers.noLines')}</Text> : null}
      <Stack gap={2} divided>
        {(lines.data ?? []).map((line) => <LineRow key={line.lineId} venueId={venueId} line={line} canDecide={isSuperAdmin} onResult={setFailure} />)}
      </Stack>
    </Stack>
  );
}
