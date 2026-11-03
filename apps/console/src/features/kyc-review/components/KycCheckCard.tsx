import { useKycImageUrl, type KycCheck } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Box, Heading, Inline, KycPhoto, Stack, Text } from '@rivr/ui';
import { checkDetails, checkSince, checkStatus, mayReopen } from './checkText.ts';
import { ReopenForm } from './ReopenForm.tsx';
import { ReviewForm } from './ReviewForm.tsx';

/** What the vendor found, label and value on a line each. */
function Details({ check }: { check: KycCheck }) {
  return (
    <Stack gap={0} divided>
      {checkDetails(check).map((detail) => (
        <Inline key={detail.label} gap={4} justify="between">
          <Text variant="row" tone="muted">{detail.label}</Text>
          <Text variant="row">{detail.value}</Text>
        </Inline>
      ))}
    </Stack>
  );
}

interface KycCheckCardProps {
  venueId: string;
  check: KycCheck;
  canReopen: boolean;
  /** The decision went through: the screen keeps this check open, so a refused one shows where it ended. */
  onDecided: () => void;
}

/**
 * One identity check, open beside the queue (console v3): the KYC photo, why it waits and since when, what the vendor
 * found, the members whose checks hold the same PAN, Aadhaar or face, and, while it waits for review, the decision; for
 * a super admin, a refused check done in person can be reopened.
 */
export function KycCheckCard({ venueId, check, canReopen, onDecided }: KycCheckCardProps) {
  const photo = useKycImageUrl(check.photoPath);
  const photoStatus = check.photoPath === null ? 'missing' : photo.isPending ? 'loading' : photo.isError ? 'error' : 'ready';
  const status = checkStatus(check);
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={5}>
        <Inline gap={5} align="start" wrap>
          <KycPhoto alt={t('console.kycReview.photoOf', { name: check.fullName })} src={photo.data ?? null} status={photoStatus} />
          <Stack gap={3} grow>
            <Stack gap={1}>
              <Heading level={2}>{check.fullName}</Heading>
              <Text variant="secondary" tone="muted">{checkSince(check)}</Text>
            </Stack>
            {status === null ? null : <Text weight="medium">{status}</Text>}
            <Details check={check} />
          </Stack>
        </Inline>
        {check.clashesWith.length > 0 ? <Text>{t('console.kycReview.clashes', { names: check.clashesWith.join(', ') })}</Text> : null}
        {check.status === 'needs_review' ? (
          <ReviewForm venueId={venueId} memberId={check.memberId} fullName={check.fullName}
            needsDateOfBirth={check.dateOfBirth === null} needsPan={check.pan === null} onDecided={onDecided} />
        ) : null}
        {mayReopen(check, canReopen) ? <ReopenForm venueId={venueId} memberId={check.memberId} fullName={check.fullName} /> : null}
      </Stack>
    </Box>
  );
}
