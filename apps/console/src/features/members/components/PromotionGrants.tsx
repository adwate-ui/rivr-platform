import { useMemberPromotionGrants, type MemberPromotionGrant } from '@rivr/db';
import { formatDate, formatNumber, t } from '@rivr/i18n';
import { Button, Heading, LoadState, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Lines shown at first, and how many more each Show earlier adds. */
const PAGE = 20;

// A perk is a code in the database (promotion_grant.perk); it reads as the promotion builder names the reward.
const PERKS = {
  cab_home: 'console.promotions.builder.rewards.cab_home.label',
  tournament_entry: 'console.promotions.builder.rewards.tournament_entry.label',
  waitlist_priority: 'console.promotions.builder.rewards.waitlist_priority.label',
} as const;

function perkWords(perk: string): string {
  const key = Object.entries(PERKS).find(([code]) => code === perk)?.[1];
  return key === undefined ? '' : t(key);
}

/** What a grant gave, in words: points, bonus chips, spins and a perk, as many as it gave. */
function given(grant: MemberPromotionGrant): string {
  const parts = [
    ...(grant.points > 0 ? [t('console.members.grantPoints', { count: formatNumber(grant.points) })] : []),
    ...(grant.chips > 0 ? [t('console.members.grantChips', { count: formatNumber(grant.chips) })] : []),
    ...(grant.spins === 1 ? [t('console.members.grantSpin')] : []),
    ...(grant.spins > 1 ? [t('console.members.grantSpins', { count: formatNumber(grant.spins) })] : []),
    ...(grant.perk === null ? [] : [perkWords(grant.perk)]),
  ];
  return parts.filter((part) => part !== '').join(', ');
}

function Body({ grants, count, onMore }: { grants: ReturnType<typeof useMemberPromotionGrants>; count: number; onMore: () => void }) {
  if (grants.isError) return <LoadState isError onRetry={() => void grants.refetch()} />;
  if (grants.data === undefined) return <LoadState />;
  if (grants.data.length === 0) return <Text tone="muted">{t('console.members.noGrants')}</Text>;
  return (
    <Stack gap={2}>
      <Stack gap={2} divided>
        {grants.data.map((grant) => (
          <Text key={grant.id}>{t('console.members.grantLine', { date: formatDate(new Date(grant.grantedAt)), promotion: grant.promotion, given: given(grant) })}</Text>
        ))}
      </Stack>
      {grants.data.length < count ? null : <Button variant="text" size="small" onClick={onMore}>{t('console.members.bonus.showEarlier')}</Button>}
    </Stack>
  );
}

/** The promotions a member was given (console v3, phase 7), newest first, twenty at a time (F-103), on the record's Visits part. */
export function PromotionGrants({ memberId }: { memberId: string }) {
  const [count, setCount] = useState(PAGE);
  const grants = useMemberPromotionGrants(memberId, count);
  return (
    <Stack gap={2}>
      <Heading level={3}>{t('console.members.grantsTitle')}</Heading>
      <Body grants={grants} count={count} onMore={() => setCount(count + PAGE)} />
    </Stack>
  );
}
