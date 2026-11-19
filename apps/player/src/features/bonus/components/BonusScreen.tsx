import { useFeature } from '@rivr/db';
import { useMyBonus } from '@rivr/db/bonus';
import { formatChips, playerBonus, registerMessages, t } from '@rivr/i18n';
import { BalanceTile, FeatureGate, Screen, Stack } from '@rivr/ui';
import { BonusHistory } from './BonusSection.tsx';
import { ReferralSection } from './ReferralSection.tsx';

// The tab's copy loads with the tab, so the app's first load carries none of it (#344).
registerMessages({ playerBonus });

/** The line under the balance: the club's own from Content (#1065), or the app's own, and nothing more (the owner, 18 Nov; #1074). */
const balanceLine = (line: string | null) => line ?? t('common.bonusLineDefault');

/**
 * Bonus (redesign of 15 Nov 2026): the member's balance and what it is for, its history, the newest first, behind
 * rewards.bonus (rule 8; a member an override locked out sees the locked notice in its place), and Refer a friend.
 */
export function BonusScreen() {
  const bonus = useFeature('rewards.bonus');
  const mine = useMyBonus();
  const title = t('playerBonus.title');
  const look = { titleLook: 'serif' } as const;
  if (mine.isPending) return <Screen {...look} title={title} status="loading" loadingLook="skeleton" />;
  if (mine.data === undefined) return <Screen {...look} title={title} status="error" onRetry={() => void mine.refetch()} />;
  if (mine.data === null) return <Screen {...look} title={title} status="empty" emptyText={t('playerBonus.notMember')} />;
  return (
    <Screen {...look} title={title}>
      <Stack gap={8}>
        <FeatureGate access={bonus}>
          <Stack gap={6}>
            <BalanceTile look="hero" figure={formatChips(mine.data.balance)} label={t('playerBonus.balance')}
              line={mine.data.balance < 0n ? t('playerBonus.owedLine') : balanceLine(mine.data.line)} />
            <BonusHistory />
          </Stack>
        </FeatureGate>
        <ReferralSection />
      </Stack>
    </Screen>
  );
}
