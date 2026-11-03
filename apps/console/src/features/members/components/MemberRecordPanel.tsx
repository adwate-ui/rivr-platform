import { useKycImageUrl, useMemberRecord, type MemberRecord } from '@rivr/db';
import { formatDate, formatStakes, t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Heading, Inline, KycPhoto, kycPhotoStatus, Stack, Text, LoadState } from '@rivr/ui';
import { useState } from 'react';
import { EarlyDepartures } from './EarlyDepartures.tsx';
import { ChangePhone } from './ChangePhone.tsx';
import { EraseMember } from './EraseMember.tsx';
import { FeatureOverrides } from './FeatureOverrides.tsx';
import { MemberBreak } from './MemberBreak.tsx';
import { partsFor, RECORD_PARTS, type RecordPart } from './recordParts.ts';
import { TierForm } from './TierForm.tsx';

/** What the staff member may do on a record: change the tier and set a break, see the KYC photo, override features and erase (super admins). */
export interface RecordAccess {
  readonly manage: boolean;
  readonly seePhoto: boolean;
  readonly override: boolean;
  readonly erase: boolean;
  /** A super admin changes the member's phone number, their login (#502). */
  readonly changePhone: boolean;
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

const PART_LABELS = {
  visits: 'console.members.visitsTitle',
  membership: 'console.members.parts.membership',
  account: 'console.members.parts.account',
} as const;

interface PartProps {
  venueId: string;
  record: MemberRecord;
  can: RecordAccess;
}

/** One part of the record: visits and early departures; the tier and a break; or the account's overrides, number and erasure. */
function PartContent({ part, venueId, record, can }: PartProps & { part: RecordPart }) {
  if (part === 'membership') {
    return (
      <Stack gap={6}>
        <TierForm venueId={venueId} record={record} />
        <MemberBreak venueId={venueId} memberId={record.memberId} />
      </Stack>
    );
  }
  if (part === 'account') {
    return (
      <Stack gap={6}>
        {can.override ? <FeatureOverrides venueId={venueId} memberId={record.memberId} /> : null}
        {can.changePhone ? <ChangePhone venueId={venueId} memberId={record.memberId} currentPhone={record.phone} /> : null}
        {can.erase ? <EraseMember venueId={venueId} memberId={record.memberId} /> : null}
      </Stack>
    );
  }
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={3}>{t('console.members.visitsTitle')}</Heading>
        <Text>{visitsLine(record)}</Text>
      </Stack>
      <EarlyDepartures venueId={venueId} memberId={record.memberId} />
    </Stack>
  );
}

/**
 * The record's parts, one shown at a time and chosen as Members chooses a tier, so the record is no longer one long scroll
 * (C-02). Not Tabs: those parts each have an address, and the open record has none. One part alone needs no choice.
 */
function RecordParts({ venueId, record, can }: PartProps) {
  const [part, setPart] = useState<RecordPart>('visits');
  const parts = partsFor(can);
  return (
    <Stack gap={6}>
      {parts.length > 1 ? (
        <ChoiceChips label={t('console.members.parts.label', { name: record.fullName })} mode="one" selected={[part]}
          options={parts.map((id) => ({ value: id, label: t(PART_LABELS[id]) }))}
          onChange={([picked]) => { const next = RECORD_PARTS.find((one) => one === picked); if (next !== undefined) setPart(next); }} />
      ) : null}
      <PartContent part={part} venueId={venueId} record={record} can={can} />
    </Stack>
  );
}

function Record({ venueId, record, can }: PartProps) {
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
          {record.knownAs === null ? null : <Text variant="small" tone="muted">{t('console.members.knownAs', { name: record.knownAs })}</Text>}
          <Text variant="small" tone="muted">{statusLine(record)}</Text>
          {record.qualifying === null ? null : (
            <Text variant="small" tone="muted">{t('console.members.qualifying', { stakes: formatStakes(record.qualifying.smallBlind, record.qualifying.bigBlind) })}</Text>
          )}
        </Stack>
      </Inline>
      <RecordParts venueId={venueId} record={record} can={can} />
    </Stack>
  );
}

/**
 * The member record (#60): KYC photo, tier and qualifying stake, then its parts, one at a time (C-02): visits and early departures; a tier
 * change and a break (A5-14) for members.manage; feature overrides (#61), the phone number and erasure on request (#424) for super admins.
 */
export function MemberRecordPanel({ venueId, memberId, can }: { venueId: string; memberId: string; can: RecordAccess }) {
  const record = useMemberRecord(venueId, memberId);
  if (record.isError) {
    return (
      <LoadState isError onRetry={() => void record.refetch()} />
    );
  }
  if (record.data === undefined) return <LoadState />;
  if (record.data === null) return <ErrorMessage>{t('console.members.failures.noMember')}</ErrorMessage>;
  return <Record venueId={venueId} record={record.data} can={can} />;
}
