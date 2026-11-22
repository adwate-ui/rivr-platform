import { useMemberAccountStatuses, type MemberRecord } from '@rivr/db';
import { formatDate, formatMobile, t } from '@rivr/i18n';
import { DetailRow, Stack } from '@rivr/ui';
import { FeatureOverrides } from './FeatureOverrides.tsx';
import { accountWords } from './memberColumns.tsx';

/** The tier, and its last day for a change that ends: `Gold tier`, `Gold until 30 Nov 2026`. */
function tierWords(record: MemberRecord): string {
  return record.tierUntil === null ? t('console.members.tierLine', { tier: record.tierName })
    : t('console.members.tierUntil', { tier: record.tierName, date: formatDate(new Date(`${record.tierUntil}T12:00:00+05:30`)) });
}

/**
 * The tier and the break, to view, for the floor (the owner, 22 Nov): staff who change them (members.manage) have the
 * forms instead. The break is a dash until the venue's statuses are read, as the record's header has it.
 */
export function MembershipView({ venueId, record }: { venueId: string; record: MemberRecord }) {
  const statuses = useMemberAccountStatuses(venueId).data;
  const breakWords = statuses === undefined ? t('console.members.notHere') : accountWords(statuses.get(record.memberId));
  return (
    <Stack gap={0}>
      <DetailRow label={t('console.members.tier')} value={tierWords(record)} labelTone="muted" size="small" />
      <DetailRow label={t('console.members.break.title')} value={breakWords} labelTone="muted" size="small" isLast />
    </Stack>
  );
}

/**
 * The account's details, to view, for the floor (the owner, 22 Nov): the mobile and the feature overrides. Changing the
 * number, overriding a feature and erasure stay with super admins; identity documents too (9 Nov).
 */
export function AccountView({ venueId, record }: { venueId: string; record: MemberRecord }) {
  return (
    <Stack gap={6}>
      {record.phone === null ? null : (
        <DetailRow label={t('console.members.mobile')} value={formatMobile(record.phone)} labelTone="muted" size="small" isLast />
      )}
      <FeatureOverrides venueId={venueId} memberId={record.memberId} canChange={false} />
    </Stack>
  );
}
