import { useKycImageUrl, type KycCheck } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Inline, Photo, Stack, Text } from '@rivr/ui';
import { checkDetails, checkStatus } from './checkText.ts';
import { ReviewForm } from './ReviewForm.tsx';

/**
 * One identity check: the KYC photo, what the vendor found, the members whose checks hold the same
 * PAN, Aadhaar or face, and, while it waits for review, the decision.
 */
export function KycCheckCard({ venueId, check }: { venueId: string; check: KycCheck }) {
  const photo = useKycImageUrl(check.photoPath);
  const photoStatus = check.photoPath === null ? 'missing' : photo.isPending ? 'loading' : photo.isError ? 'error' : 'ready';
  const status = checkStatus(check);
  return (
    <Inline gap={6} align="start">
      <Photo alt={t('console.kycReview.photoOf', { name: check.fullName })} src={photo.data ?? null} status={photoStatus} />
      <Stack gap={3} grow>
        <Heading level={3}>{check.fullName}</Heading>
        <Stack gap={1}>
          {checkDetails(check).map((detail) => (
            <Inline key={detail.label} gap={3}>
              <Text tone="muted">{detail.label}</Text>
              <Text>{detail.value}</Text>
            </Inline>
          ))}
        </Stack>
        {check.clashesWith.length > 0 ? <Text>{t('console.kycReview.clashes', { names: check.clashesWith.join(', ') })}</Text> : null}
        {status === null ? null : <Text weight="medium">{status}</Text>}
        {check.status === 'needs_review' ? (
          <ReviewForm venueId={venueId} memberId={check.memberId} fullName={check.fullName} needsDateOfBirth={check.dateOfBirth === null} />
        ) : null}
      </Stack>
    </Inline>
  );
}
