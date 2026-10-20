import { TAB_FEATURES } from '@rivr/contracts';
import { cellKey, type ShowsAs, type TierMatrix } from '@rivr/db';
import { formatList, t, type MessageKey } from '@rivr/i18n';
import { BottomNav, ChoiceChips, Container, Heading, Stack, Text, type BottomNavItem, type FeatureAccess } from '@rivr/ui';
import { useState } from 'react';

const ENABLED: FeatureAccess = { state: 'enabled' };

const LIST_COPY: Readonly<Record<ShowsAs, MessageKey>> = {
  enabled: 'console.tiers.previewOn',
  locked: 'console.tiers.previewLocked',
  hidden: 'console.tiers.previewHidden',
};
const SHOWS_AS: readonly ShowsAs[] = ['enabled', 'locked', 'hidden'];

/**
 * The player app as a member of one tier with no override sees it (additions "Tier-gated features"):
 * its tabs, locked or hidden as the database decides (tier_matrix), and every gateable feature by how
 * it shows. The tabs go nowhere from here.
 */
export function TierPreview({ matrix }: { matrix: TierMatrix }) {
  const [chosen, setChosen] = useState(matrix.tiers[0]?.tierId ?? '');
  const access = (featureKey: string): FeatureAccess => {
    const cell = matrix.cells.get(cellKey(chosen, featureKey));
    if (cell === undefined || cell.showsAs === 'hidden') return { state: 'hidden' };
    return cell.showsAs === 'locked' ? { state: 'locked', tiers: cell.tiersWithIt } : ENABLED;
  };
  const tabs: BottomNavItem[] = [
    { tab: 'home', href: '/', access: ENABLED },
    { tab: 'sessions', href: '/sessions', access: access(TAB_FEATURES.sessions) },
    { tab: 'balance', href: '/balance', access: ENABLED },
    { tab: 'rewards', href: '/rewards', access: ENABLED },
    { tab: 'learn', href: '/learn', access: access(TAB_FEATURES.learn) },
  ];
  const namesShowing = (showsAs: ShowsAs) =>
    matrix.features.filter((feature) => (matrix.cells.get(cellKey(chosen, feature.key))?.showsAs ?? 'hidden') === showsAs).map((feature) => feature.name);
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tiers.preview')}</Heading>
      <ChoiceChips label={t('console.tiers.previewTier')} mode="one" selected={[chosen]}
        options={matrix.tiers.map((tier) => ({ value: tier.tierId, label: tier.name }))}
        onChange={(tiers) => { if (tiers[0] !== undefined) setChosen(tiers[0]); }} />
      <Container width="phone">
        <BottomNav items={tabs} current="home" onNavigate={() => undefined} />
      </Container>
      {SHOWS_AS.map((showsAs) => {
        const names = namesShowing(showsAs);
        return <Text key={showsAs}>{t(LIST_COPY[showsAs], { features: names.length === 0 ? t('console.tiers.previewNone') : formatList(names) })}</Text>;
      })}
    </Stack>
  );
}
