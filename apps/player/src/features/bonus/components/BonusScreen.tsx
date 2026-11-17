import { useFeature } from '@rivr/db';
import { useMyBonus } from '@rivr/db/bonus';
import { bonusLastsDays } from '@rivr/domain/bonus';
import { formatChips, formatNumber, playerBonus, registerMessages, t } from '@rivr/i18n';
import { BalanceTile, FeatureGate, Screen, Stack } from '@rivr/ui';
import { BonusHistory } from './BonusSection.tsx';
import { ReferralSection } from './ReferralSection.tsx';

// The tab's copy loads with the tab, so the app's first load carries none of it (#344).
registerMessages({ playerBonus });

/** Whether Bonus expires, as the club's "Bonus expires" setting says (redesign RD-20; `bonusLastsDays` in @rivr/domain/bonus). */
function expirySentence(expiryDays: number | null): string {
  const days = bonusLastsDays(expiryDays);
  if (days === null) return t('playerBonus.neverExpires');
  return days === 1 ? t('playerBonus.expiresOne') : t('playerBonus.expires', { days: formatNumber(days) });
}

/** The club's line as a sentence, so the expiry sentence after it starts afresh: `Use it tonight` is `Use it tonight.`. */
const asSentence = (line: string) => (/[.!?…]$/.test(line) ? line : `${line}.`);

/** The line under the balance: what Bonus is for, as Content sets it or the app's own (#1065), then whether it expires. */
const balanceLine = (expiryDays: number | null, line: string | null) =>
  t('playerBonus.lineWith', { line: asSentence(line ?? t('common.bonusLineDefault')), expiry: expirySentence(expiryDays) });

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
            <BalanceTile look="hero" figure={formatChips(mine.data.balance)} label={t('playerBonus.balance')} line={balanceLine(mine.data.expiryDays, mine.data.line)} />
            <BonusHistory />
          </Stack>
        </FeatureGate>
        <ReferralSection />
      </Stack>
    </Screen>
  );
}
