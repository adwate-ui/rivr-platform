import { useKycImageUrl, useMemberAccountStatuses, useMemberRecord, type MemberRecord } from '@rivr/db';
import { useOpenHostOffers } from '@rivr/db/hostQueue';
import { formatDate, formatHostOffer, formatNumber, formatStakes, t } from '@rivr/i18n';
import { Box, DetailRow, ErrorMessage, Heading, Inline, KycPhoto, kycPhotoStatus, LoadState, Stack, Tabs, Text } from '@rivr/ui';
import { ChangePhone } from './ChangePhone.tsx';
import { EarlyDepartures } from './EarlyDepartures.tsx';
import { EraseMember } from './EraseMember.tsx';
import { FeatureOverrides } from './FeatureOverrides.tsx';
import { AccountStatusDot } from './memberColumns.tsx';
import { MemberBonus } from './MemberBonus.tsx';
import { MemberBreak } from './MemberBreak.tsx';
import { MemberIdDocuments } from './MemberIdDocuments.tsx';
import { MemberSignUp } from './MemberSignUp.tsx';
import { MemberVisits } from './MemberVisits.tsx';
import { PromotionGrants } from './PromotionGrants.tsx';
import { partsFor, recordHref, type RecordPart } from './recordParts.ts';
import { SeatLine } from './SeatLine.tsx';
import { TierForm } from './TierForm.tsx';
import type { Tonight } from './tonight.ts';

/** What the staff member may do on a record: change the tier and set a break, see the KYC photo, override features and erase (super admins). */
export interface RecordAccess {
  /** A super admin exports members' identity documents (the owner, 9 Nov). */
  readonly seesIdentity: boolean;
  readonly manage: boolean;
  readonly seePhoto: boolean;
  readonly override: boolean;
  readonly erase: boolean;
  /** A super admin changes the member's phone number, their login (#502). */
  readonly changePhone: boolean;
  /** A super admin withdraws an early departure recorded by mistake (decision 0500). */
  readonly withdrawDeparture: boolean;
}

/** Member number, tier (and a change's last day), KYC and whether they are in the room. */
function statusLine(record: MemberRecord): string {
  const tier = record.tierUntil === null ? t('console.members.tierLine', { tier: record.tierName })
    : t('console.members.tierUntil', { tier: record.tierName, date: formatDate(new Date(`${record.tierUntil}T12:00:00+05:30`)) });
  const kyc = record.isKycComplete ? t('console.members.kycVerified') : t('console.members.kycIncomplete');
  const parts = [t('console.members.memberNumber', { number: String(record.memberNumber) }), tier, kyc];
  return (record.isInRoom ? [...parts, t('console.members.inRoom')] : parts).join(' · ');
}

const PART_LABELS = {
  visits: 'console.members.visitsTitle',
  bonus: 'console.members.parts.bonus',
  signUp: 'console.members.parts.signUp',
  membership: 'console.members.parts.membership',
  account: 'console.members.parts.account',
} as const;

interface PartProps {
  venueId: string;
  record: MemberRecord;
  can: RecordAccess;
}

/** Visits (console v3): how many and the last, each visit (F-017), early departures, and what promotions gave the member. */
function VisitsPart({ venueId, record, can }: PartProps) {
  const last = record.lastVisitAt === null ? t('console.members.never') : formatDate(new Date(record.lastVisitAt));
  return (
    <Stack gap={6}>
      <Stack gap={0}>
        <DetailRow label={t('console.members.visits')} value={formatNumber(record.visits)} labelTone="muted" size="small" />
        <DetailRow label={t('console.members.lastVisit')} value={last} labelTone="muted" size="small" isLast />
      </Stack>
      <MemberVisits venueId={venueId} memberId={record.memberId} />
      <EarlyDepartures venueId={venueId} memberId={record.memberId} canWithdraw={can.withdrawDeparture} />
      <PromotionGrants memberId={record.memberId} />
    </Stack>
  );
}

/** One part of the record: visits; bonus chips; sign-up; the tier and a break; or the account's overrides, number and erasure. */
function PartContent({ part, venueId, record, can }: PartProps & { part: RecordPart }) {
  if (part === 'bonus') return <MemberBonus venueId={venueId} memberId={record.memberId} />;
  if (part === 'signUp') return <MemberSignUp venueId={venueId} memberId={record.memberId} />;
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
        {can.seesIdentity ? <MemberIdDocuments venueId={venueId} memberId={record.memberId} /> : null}
        {can.override ? <FeatureOverrides venueId={venueId} memberId={record.memberId} /> : null}
        {can.changePhone ? <ChangePhone venueId={venueId} memberId={record.memberId} currentPhone={record.phone} /> : null}
        {can.erase ? <EraseMember venueId={venueId} memberId={record.memberId} /> : null}
      </Stack>
    );
  }
  return <VisitsPart venueId={venueId} record={record} can={can} />;
}

/** What a host promised this member, for the floor to give by hand (F-015); nothing when no offer is open. */
function OfferLine({ venueId, memberId }: { venueId: string; memberId: string }) {
  const offer = useOpenHostOffers(venueId).data?.find((one) => one.memberId === memberId)?.offer;
  return offer === undefined ? null : <Text variant="small" tone="accent">{t('console.hostQueue.offered', { offer: formatHostOffer(offer) })}</Text>;
}

/** How the account stands when it is not simply active; a dash until that is known, so a failed read never passes as active (F-121). */
function AccountLine({ venueId, memberId }: { venueId: string; memberId: string }) {
  const statuses = useMemberAccountStatuses(venueId).data;
  if (statuses === undefined) return <Text variant="small" tone="muted">{t('console.members.notHere')}</Text>;
  const status = statuses.get(memberId);
  return status === undefined ? null : <AccountStatusDot status={status} />;
}

/** The record's header: the KYC photo for those who may see it, the name, its status lines and a host's open offer. */
function RecordHeader({ venueId, record, can }: { venueId: string; record: MemberRecord; can: RecordAccess }) {
  // KYC photos are for KYC reviewers and the cage (authorize_kyc_image); other staff see none rather than an error.
  const photo = useKycImageUrl(can.seePhoto ? record.photoPath : null);
  return (
    <Inline gap={4} align="center">
      {can.seePhoto ? (
        <KycPhoto alt={t('console.cage.photoOf', { name: record.fullName })} src={photo.data ?? null} status={kycPhotoStatus(record.photoPath, photo)} />
      ) : null}
      <Stack gap={1}>
        <Heading level={2}>{record.fullName}</Heading>
        {record.knownAs === null ? null : <Text variant="small" tone="muted">{t('console.members.knownAs', { name: record.knownAs })}</Text>}
        <Text variant="small" tone="muted">{statusLine(record)}</Text>
        <AccountLine venueId={venueId} memberId={record.memberId} />
        {record.qualifying === null ? null : (
          <Text variant="small" tone="muted">{t('console.members.qualifying', { stakes: formatStakes(record.qualifying.smallBlind, record.qualifying.bigBlind) })}</Text>
        )}
        <OfferLine venueId={venueId} memberId={record.memberId} />
      </Stack>
    </Inline>
  );
}

interface RecordProps extends PartProps {
  part: string | undefined;
  tonight: Tonight | undefined;
  onNavigate: (href: string) => void;
}

/**
 * The record, its parts as tabs in the address (console v3; C-02): Visits, Bonus chips and Sign-up for all, Tier and break
 * for members.manage, Account for super admins. A part the staff member may not open shows Visits.
 */
function Record({ venueId, record, can, part, tonight, onNavigate }: RecordProps) {
  const parts = partsFor(can);
  const current = parts.find((one) => one === part) ?? 'visits';
  return (
    <Stack gap={6}>
      <RecordHeader venueId={venueId} record={record} can={can} />
      {tonight?.kind === 'seated' ? <SeatLine name={record.fullName} seat={tonight} onNavigate={onNavigate} /> : null}
      {parts.length > 1 ? (
        <Tabs label={t('console.members.parts.label', { name: record.fullName })} current={current} onNavigate={onNavigate}
          tabs={parts.map((id) => ({ id, label: t(PART_LABELS[id]), href: recordHref(record.memberId, id) }))} />
      ) : null}
      <PartContent part={current} venueId={venueId} record={record} can={can} />
    </Stack>
  );
}

/**
 * The member record (#60), docked beside the list (console v3): KYC photo, tier and qualifying stake, the seat tonight
 * with a link to it on the floor, then its parts, one at a time: visits, early departures and promotions given; a tier
 * change and a break (A5-14) for members.manage; feature overrides (#61), the phone number and erasure (#424) for super admins.
 */
export function MemberRecordPanel({ venueId, memberId, ...rest }: Omit<RecordProps, 'record'> & { memberId: string }) {
  const record = useMemberRecord(venueId, memberId);
  if (record.isError) return <LoadState isError onRetry={() => void record.refetch()} />;
  if (record.data === undefined) return <LoadState />;
  if (record.data === null) return <ErrorMessage>{t('console.members.failures.noMember')}</ErrorMessage>;
  return (
    <Box surface="raised" padding={6} radius="md">
      <Record venueId={venueId} record={record.data} {...rest} />
    </Box>
  );
}
