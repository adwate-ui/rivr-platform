import { useHouseRules, type HouseRules } from '@rivr/db/houseRules';
import { formatNumber, t } from '@rivr/i18n';
import { BackButton, Figure, Inline, Screen, Stack, Text } from '@rivr/ui';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';

/** The rules, each with its number in gold, between hairlines (brief 3.10). */
function Rules({ rules }: { rules: HouseRules }) {
  return (
    <Stack gap={3} divided>
      {rules.rules.map((rule, index) => (
        // The numeral sits on its rule's first line (F-160).
        <Inline key={`${String(index)}-${rule}`} gap={4} align="baseline">
          <Figure size="numeral" tone="money">{formatNumber(index + 1)}</Figure>
          <Text>{rule}</Text>
        </Inline>
      ))}
    </Stack>
  );
}

/**
 * House rules (brief 3.10; #637), from Profile: back to Profile, the title and its line, and the club's rules numbered in
 * gold. The club writes them on the website (decision 0296); the game's legal standing stays on its About page (the owner,
 * 12 Nov).
 */
export function HouseRulesScreen() {
  const rules = useHouseRules();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  // Back to where it was opened from, or to /profile in its place: never a new entry on top (owner, 8 Nov).
  const toProfile = () => (canGoBack ? router.history.back() : void navigate({ to: '/profile', replace: true }));
  const title = t('player.houseRules.title');
  const back = <BackButton label={t('player.profile.title')} onBack={toProfile} />;
  const look = { titleLook: 'serif' } as const;
  if (rules.isError) return <Stack gap={2}>{back}<Screen {...look} title={title} status="error" onRetry={() => void rules.refetch()} /></Stack>;
  if (rules.data === undefined) return <Stack gap={2}>{back}<Screen {...look} title={title} status="loading" loadingLook="skeleton" /></Stack>;
  if (rules.data.rules.length === 0) {
    return <Stack gap={2}>{back}<Screen {...look} title={title} status="empty" emptyText={t('player.houseRules.empty')} /></Stack>;
  }
  return (
    <Stack gap={2}>
      {back}
      <Screen {...look} title={title}>
        <Stack gap={6}>
          <Text tone="muted">{rules.data.intro ?? t('player.houseRules.appliesAtEveryTable')}</Text>
          <Rules rules={rules.data} />
        </Stack>
      </Screen>
    </Stack>
  );
}
