import { useKycImageUrl, useMemberRecord, type MemberRecord } from '@rivr/db';
import { formatDate, formatStakes, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, KycPhoto, kycPhotoStatus, Stack, Text } from '@rivr/ui';
import { EarlyDepartures } from './EarlyDepartures.tsx';
import { EraseMember } from './EraseMember.tsx';
import { FeatureOverrides } from './FeatureOverrides.tsx';
import { TierForm } from './TierForm.tsx';

/** What the staff member may do on a record: change the tier, see the KYC photo, override features and erase (super admins). */
export interface RecordAccess {
  readonly manage: boolean;
  readonly seePhoto: boolean;
  readonly override: boolean;
  readonly erase: boolean;
}

/** Member number, tier (and a change's last day), KYC and whether they are in the room. */
function statusLine(record: MemberRecord): string {
  const tier = record.tierUntil === null ? record.tierName
    : t('console.members.tierUntil', { tier: record.tierName, date: formatDate(new Date(`${record.tierUntil}T12:00:00+05:30`)) });
  const kyc = record.isKycComplete ? t('console.members.kycVerified') : t('console.members.kycIncomplete');
  const parts = [t('console.members.memberNumber', { number: String(record.memberNumber) }), tier, kyc];
  return (record.isInRoom ? [...parts, t('console.members.inRoom')] : parts).join(' · ');
}

function visitsLine(record: MemberRecord): string {
  if (record.lastVisitAt === null) return t('console.members.noVisits');
  const date = formatDate(new Date(record.lastVisitAt));
  return record.visits === 1 ? t('console.members.visitsOne', { date }) : t('console.members.visitsLine', { count: record.visits, date });
}

function Record({ venueId, record, can }: { venueId: string; record: MemberRecord; can: RecordAccess }) {
  // KYC photos are for KYC reviewers and the cage (authorize_kyc_image); other staff see none rather than an error.
  const photo = useKycImageUrl(can.seePhoto ? record.photoPath : null);
  return (
    <Stack gap={6}>
      <Inline gap={4} align="center">
        {can.seePhoto ? (
          <KycPhoto alt={t('console.cage.photoOf', { name: record.fullName })} src={photo.data ?? null} status={kycPhotoStatus(record.photoPath, photo)} />
        ) : null}
        <Stack gap={1}>
          <Heading level={2}>{record.fullName}</Heading>
          <Text variant="small" tone="muted">{statusLine(record)}</Text>
          {record.qualifying === null ? null : (
            <Text variant="small" tone="muted">{t('console.members.qualifying', { stakes: formatStakes(record.qualifying.smallBlind, record.qualifying.bigBlind) })}</Text>
          )}
        </Stack>
      </Inline>
      <Stack gap={2}>
        <Heading level={3}>{t('console.members.visitsTitle')}</Heading>
        <Text>{visitsLine(record)}</Text>
      </Stack>
      <EarlyDepartures venueId={venueId} memberId={record.memberId} />
      {can.manage ? <TierForm venueId={venueId} record={record} /> : null}
      {can.override ? <FeatureOverrides venueId={venueId} memberId={record.memberId} /> : null}
      {can.erase ? <EraseMember venueId={venueId} memberId={record.memberId} /> : null}
    </Stack>
  );
}

/**
 * The member record (#60): KYC photo, tier and qualifying stake, visits and early departures; a tier change for members.manage,
 * and feature overrides (#61) and erasure on request (#424) for super admins.
 */
export function MemberRecordPanel({ venueId, memberId, can }: { venueId: string; memberId: string; can: RecordAccess }) {
  const record = useMemberRecord(venueId, memberId);
  if (record.isError) {
    return (
      <Stack gap={3}>
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button variant="secondary" onClick={() => void record.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (record.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  if (record.data === null) return <ErrorMessage>{t('console.members.failures.noMember')}</ErrorMessage>;
  return <Record venueId={venueId} record={record.data} can={can} />;
}
