import { useKycImageUrl, useMemberKycDocuments, useSendBackKycDocument, type KycDocument, type KycSendBackFailure } from '@rivr/db';
import { formatDate, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, KycPhoto, kycPhotoStatus, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

interface MemberProps {
  venueId: string;
  memberId: string;
}

/** Sending a photo back, saying why in words: the member is due at the desk for that photo alone. */
function SendBack({ venueId, memberId, document }: MemberProps & { document: KycDocument }) {
  const sendBack = useSendBackKycDocument(venueId, memberId);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<KycSendBackFailure | null>(null);
  const submit = async () => {
    const done = await sendBack.mutateAsync({ kind: document.kind, reason: reason.trim() });
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={3}>
      <Input
        label={t('console.kycInPerson.sendBackFor', { document: t(`console.kycInPerson.document.${document.kind}`) })}
        hint={t('console.kycInPerson.reopenHint')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={200}
        autoComplete="off"
      />
      <Inline gap={3}>
        <Button variant="subtle" size="compact" isLoading={sendBack.isPending} onClick={() => void submit()}>{t('console.kycInPerson.sendBack')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.kycInPerson.sendBackFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/** Who took a photo, and who confirmed its bars. */
function TakenBy({ document }: { document: KycDocument }) {
  return (
    <Stack gap={1}>
      <Text weight="medium">{t(`console.kycInPerson.document.${document.kind}`)}</Text>
      <Text variant="secondary" tone="muted">{t('console.kycInPerson.documentTaken', { date: formatDate(new Date(document.takenAt)), name: document.takenBy })}</Text>
      {document.coversConfirmedBy === null ? null : <Text variant="secondary" tone="muted">{t('console.kycInPerson.documentBars', { name: document.coversConfirmedBy })}</Text>}
    </Stack>
  );
}

/** One photo on file: who took it, and the photo itself only once asked for, as each opening goes in the audit log. */
function DocumentOnFile({ venueId, memberId, document }: MemberProps & { document: KycDocument }) {
  const [isOpen, setOpen] = useState(false);
  const image = useKycImageUrl(isOpen ? document.path : null, { isForgottenOnClose: true });
  const name = t(`console.kycInPerson.document.${document.kind}`);
  const isSentBack = document.retakeAskedAt !== null;
  return (
    <Stack gap={3}>
      <Inline gap={3} align="center" justify="between">
        <TakenBy document={document} />
        <Button variant="subtle" size="small" onClick={() => setOpen(!isOpen)}
          aria-label={t(isOpen ? 'console.kycInPerson.hideDocumentName' : 'console.kycInPerson.openDocumentName', { document: name })}>
          {t(isOpen ? 'console.kycInPerson.hideDocument' : 'console.kycInPerson.openDocument')}
        </Button>
      </Inline>
      {isOpen ? <KycPhoto shape="card" alt={name} src={image.data ?? null} status={kycPhotoStatus(document.path, image)} /> : null}
      {isSentBack ? <Text tone="muted">{t('console.kycInPerson.documentSentBack', { reason: document.retakeReason ?? '' })}</Text> : null}
      {isOpen && !isSentBack ? <SendBack venueId={venueId} memberId={memberId} document={document} /> : null}
    </Stack>
  );
}

/** A member's PAN and Aadhaar photos, for super admins (decision 0573). */
export function MemberIdDocuments({ venueId, memberId }: MemberProps) {
  const documents = useMemberKycDocuments(venueId, memberId);
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Heading level={3}>{t('console.kycInPerson.documentsTitle')}</Heading>
        <Text variant="secondary" tone="muted">{t('console.kycInPerson.documentsHint')}</Text>
      </Stack>
      {documents.isPending ? <LoadState /> : null}
      {documents.isError ? <LoadState isError onRetry={() => void documents.refetch()} /> : null}
      {documents.data?.length === 0 ? <Text tone="muted">{t('console.kycInPerson.documentsNone')}</Text> : null}
      {documents.data?.map((document) => <DocumentOnFile key={document.kind} venueId={venueId} memberId={memberId} document={document} />)}
    </Stack>
  );
}
