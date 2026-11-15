import { useFeature } from '@rivr/db';
import { useMyBonus } from '@rivr/db/bonus';
import { bonusLastsDays } from '@rivr/domain/bonus';
import { formatChips, formatNumber, playerBonus, registerMessages, t } from '@rivr/i18n';
import { BalanceTile, FeatureGate, Screen, Stack } from '@rivr/ui';
import { BonusHistory } from './BonusSection.tsx';
import { ReferralSection } from './ReferralSection.tsx';

// The tab's copy loads with the tab, so the app's first load carries none of it (#344).
registerMessages({ playerBonus });

/**
 * The line under the balance, which follows the club's "Bonus expires" setting (redesign RD-20; `bonusLastsDays` in
 * @rivr/domain/bonus reads it): it never expires, or expires after the days set.
 */
function balanceLine(expiryDays: number | null): string {
  const days = bonusLastsDays(expiryDays);
  if (days === null) return t('playerBonus.line');
  return days === 1 ? t('playerBonus.lineExpiresOne') : t('playerBonus.lineExpires', { days: formatNumber(days) });
}

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
            <BalanceTile look="hero" figure={formatChips(mine.data.balance)} label={t('playerBonus.balance')} line={balanceLine(mine.data.expiryDays)} />
            <BonusHistory />
          </Stack>
        </FeatureGate>
        <ReferralSection />
      </Stack>
    </Screen>
  );
}
