import { useFeature } from '@rivr/db';
import { useMyBonus } from '@rivr/db/bonus';
import { formatChips, playerBonus, registerMessages, t } from '@rivr/i18n';
import { BalanceTile, FeatureGate, Screen, Stack } from '@rivr/ui';
import { BonusHistory } from './BonusSection.tsx';
import { ReferralSection } from './ReferralSection.tsx';

// The tab's copy loads with the tab, so the app's first load carries none of it (#344).
registerMessages({ playerBonus });

/**
 * Bonus (redesign of 15 Nov 2026): the member's balance and what it is for, its history, the newest first, behind
 * rewards.bonus (rule 8; a member an override locked out sees the locked notice in its place), and Refer a friend.
 */
export function BonusScreen() {
  const bonus = useFeature('rewards.bonus');
  const balance = useMyBonus();
  const title = t('playerBonus.title');
  const look = { titleLook: 'serif' } as const;
  if (balance.isPending) return <Screen {...look} title={title} status="loading" loadingLook="skeleton" />;
  if (balance.data === undefined) return <Screen {...look} title={title} status="error" onRetry={() => void balance.refetch()} />;
  if (balance.data === null) return <Screen {...look} title={title} status="empty" emptyText={t('playerBonus.notMember')} />;
  return (
    <Screen {...look} title={title}>
      <Stack gap={8}>
        <FeatureGate access={bonus}>
          <Stack gap={6}>
            <BalanceTile icon="chip" tone="money" figure={formatChips(balance.data)} label={t('playerBonus.balance')} line={t('playerBonus.line')} />
            <BonusHistory />
          </Stack>
        </FeatureGate>
        <ReferralSection />
      </Stack>
    </Screen>
  );
}
