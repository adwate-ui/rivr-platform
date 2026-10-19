import { useKycImageUrl, type KycCheck } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Inline, KycPhoto, Stack, Text } from '@rivr/ui';
import { checkDetails, checkSince, checkStatus, mayReopen } from './checkText.ts';
import { ReopenForm } from './ReopenForm.tsx';
import { ReviewForm } from './ReviewForm.tsx';

/**
 * One identity check: the KYC photo, why it waits and since when, what the vendor found, the members
 * whose checks hold the same PAN, Aadhaar or face, and, while it waits for review, the decision; for a
 * super admin, a refused check done in person can be reopened.
 */
export function KycCheckCard({ venueId, check, canReopen }: { venueId: string; check: KycCheck; canReopen: boolean }) {
  const photo = useKycImageUrl(check.photoPath);
  const photoStatus = check.photoPath === null ? 'missing' : photo.isPending ? 'loading' : photo.isError ? 'error' : 'ready';
  const status = checkStatus(check);
  return (
    <Inline gap={6} align="start">
      <KycPhoto alt={t('console.kycReview.photoOf', { name: check.fullName })} src={photo.data ?? null} status={photoStatus} />
      <Stack gap={3} grow>
        <Stack gap={1}>
          <Heading level={3}>{check.fullName}</Heading>
          <Text variant="small" tone="muted">{checkSince(check)}</Text>
        </Stack>
        {status === null ? null : <Text weight="medium">{status}</Text>}
        <Stack gap={1}>
          {checkDetails(check).map((detail) => (
            <Inline key={detail.label} gap={3}>
              <Text tone="muted">{detail.label}</Text>
              <Text>{detail.value}</Text>
            </Inline>
          ))}
        </Stack>
        {check.clashesWith.length > 0 ? <Text>{t('console.kycReview.clashes', { names: check.clashesWith.join(', ') })}</Text> : null}
        {check.status === 'needs_review' ? (
          <ReviewForm
            venueId={venueId}
            memberId={check.memberId}
            fullName={check.fullName}
            needsDateOfBirth={check.dateOfBirth === null}
            needsPan={check.pan === null}
          />
        ) : null}
        {mayReopen(check, canReopen) ? (
          <ReopenForm venueId={venueId} memberId={check.memberId} fullName={check.fullName} />
        ) : null}
      </Stack>
    </Inline>
  );
}
