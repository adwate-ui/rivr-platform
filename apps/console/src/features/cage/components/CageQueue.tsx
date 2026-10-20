import { useCageActions, useCageQueue, useKycImageUrl, type BuyInRequest, type CageFailure } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, KycPhoto, kycPhotoStatus, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CAGE_FAILURE_COPY } from './cageCopy.ts';

/** One request: the member's KYC photo, name, table and seat, amount and time; Approve from wallet or Decline (flow 3). */
function RequestRow({ venueId, request, onResult }: { venueId: string; request: BuyInRequest; onResult: (failure: CageFailure | null) => void }) {
  const { buyIn, decline } = useCageActions(venueId);
  const photo = useKycImageUrl(request.photoPath);
  const [requestId] = useState(() => crypto.randomUUID());
  const approve = async () => {
    const issued = await buyIn.mutateAsync({ memberId: request.memberId, amount: request.amount, method: 'wallet', utr: null, requestId, buyInRequestId: request.requestId });
    onResult(issued.ok ? null : issued.error);
  };
  return (
    <Inline gap={4} align="start" justify="between">
      <Inline gap={3} align="start">
        <KycPhoto alt={t('console.cage.photoOf', { name: request.fullName })} src={photo.data ?? null} status={kycPhotoStatus(request.photoPath, photo)} />
        <Stack gap={1}>
          <Text weight="medium">{request.fullName}</Text>
          <Text variant="small" tone="muted">{t('console.cage.requestLine', { table: request.tableName, seat: request.seat, time: formatTime(new Date(request.requestedAt)) })}</Text>
          <Money paise={request.amount} />
        </Stack>
      </Inline>
      <Stack gap={1} align="end">
        <Button variant="primary" isLoading={buyIn.isPending} onClick={() => void approve()}>{t('console.cage.approveFromWallet')}</Button>
        <Button variant="text" isDisabled={decline.isPending} onClick={() => void decline.mutateAsync(request.requestId).then((done) => onResult(done.ok ? null : done.error))}>
          {t('console.cage.decline')}
        </Button>
      </Stack>
    </Inline>
  );
}

/** The cage's queue: buy-ins the tables asked for, oldest first. */
export function CageQueue({ venueId }: { venueId: string }) {
  const queue = useCageQueue(venueId);
  const [failure, setFailure] = useState<CageFailure | null>(null);
  return (
    <Stack gap={3} divided>
      <Heading level={2}>{t('console.cage.queue')}</Heading>
      {failure === null ? null : <ErrorMessage>{t(CAGE_FAILURE_COPY[failure])}</ErrorMessage>}
      {queue.isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {queue.isError ? (
        <Stack gap={2} align="start">
          <ErrorMessage>{t('console.cage.unavailable')}</ErrorMessage>
          <Button onClick={() => void queue.refetch()}>{t('common.retry')}</Button>
        </Stack>
      ) : null}
      {queue.data?.length === 0 ? <Text tone="muted">{t('console.cage.queueEmpty')}</Text> : null}
      {(queue.data ?? []).map((request) => <RequestRow key={request.requestId} venueId={venueId} request={request} onResult={setFailure} />)}
    </Stack>
  );
}
